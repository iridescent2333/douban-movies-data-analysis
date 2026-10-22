package com.movie.dashboard.controller;

import com.movie.dashboard.entity.Movie;
import com.movie.dashboard.repository.MovieRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * 海报图片代理 —— 解决豆瓣图片 CDN 防盗链问题。
 *
 * <p>背景：豆瓣海报托管在 img*.doubanio.com，该 CDN 校验 Referer——
 * 只有携带 Referer: https://movie.douban.com/ 的请求才返回 200，
 * 浏览器安全策略禁止页面伪造 Referer（referrerpolicy="no-referrer" 会得到 418），
 * 所以前端 &lt;img src="豆瓣URL"&gt; 无法直接加载。</p>
 *
 * <p>方案：由后端代理转发——服务端带上豆瓣 Referer 拉取图片字节流，
 * 落盘缓存后以同源地址返回给前端。前端统一用
 * {@code /api/works/{id}/poster}（小图）与 {@code ?size=large}（详情大图）。</p>
 *
 * <p>安全：仅代理 img*.doubanio.com 域名（白名单正则），防止被当作任意 SSRF 跳板；
 * 缓存 key 为 poster URL 的 MD5，海报内容不变，缓存永久有效。</p>
 */
@RestController
@RequestMapping("/api/works")
@Tag(name = "海报代理", description = "豆瓣海报防盗链代理（带本地磁盘缓存）")
public class PosterController {

    private static final Logger log = LoggerFactory.getLogger(PosterController.class);

    /** 只允许代理豆瓣图片 CDN，防 SSRF */
    private static final Pattern ALLOWED_HOST = Pattern.compile("^https://img\\d*\\.doubanio\\.com/.*");

    /** 服务端访问豆瓣图片必须携带的 Referer 与 UA（否则 CDN 返回 418） */
    private static final String DOUBAN_REFERER = "https://movie.douban.com/";
    private static final String BROWSER_UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

    /** 缓存目录：系统临时目录下的 movie-poster-cache，海报内容不变，永久有效 */
    private final Path cacheDir = Path.of(System.getProperty("java.io.tmpdir"), "movie-poster-cache");

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    @Autowired
    private MovieRepository movieRepository;

    /**
     * 代理某部电影的海报图。
     *
     * @param size small = 列表/榜单缩略图（s_ratio_poster）；large = 详情大图（l_ratio_poster）
     */
    @GetMapping("/{id}/poster")
    @Operation(summary = "海报图片代理", description = "服务端携带豆瓣 Referer 拉取海报并缓存，前端 <img> 直接引用本接口即可")
    public ResponseEntity<byte[]> poster(
            @Parameter(description = "豆瓣 subject id") @PathVariable Long id,
            @Parameter(description = "small=缩略图 / large=详情大图") @RequestParam(defaultValue = "small") String size) {

        Optional<Movie> movieOpt = movieRepository.findById(id);
        if (movieOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        String posterUrl = movieOpt.get().getPosterUrl();
        if (posterUrl == null || posterUrl.isBlank() || !ALLOWED_HOST.matcher(posterUrl).matches()) {
            return ResponseEntity.notFound().build();
        }

        // 详情页换大图：豆瓣海报 URL 的 /s_ratio_poster/ 段替换为 /l_ratio_poster/
        String target = posterUrl;
        if ("large".equalsIgnoreCase(size)) {
            target = posterUrl.replace("/s_ratio_poster/", "/l_ratio_poster/");
        }

        try {
            byte[] body = fetchWithCache(target);
            if (body == null || body.length == 0) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(mediaType(target)))
                    .cacheControl(org.springframework.http.CacheControl.maxAge(java.time.Duration.ofDays(7)))
                    .eTag(md5(target))
                    .body(body);
        } catch (Exception e) {
            log.warn("[Poster] 代理失败: {} -> {}", target, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
        }
    }

    /** 带磁盘缓存的拉取：命中缓存直接读文件，否则请求豆瓣并写缓存 */
    private byte[] fetchWithCache(String url) throws IOException, InterruptedException {
        Files.createDirectories(cacheDir);
        Path cacheFile = cacheDir.resolve(md5(url) + ".bin");

        if (Files.exists(cacheFile) && Files.size(cacheFile) > 0) {
            return Files.readAllBytes(cacheFile);
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(15))
                .header(HttpHeaders.USER_AGENT, BROWSER_UA)
                .header(HttpHeaders.REFERER, DOUBAN_REFERER)
                .GET()
                .build();

        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() != 200) {
            log.warn("[Poster] 豆瓣返回 {} : {}", response.statusCode(), url);
            return null;
        }
        byte[] body = response.body();
        Files.write(cacheFile, body);   // 写入缓存，下次同图直接读盘
        return body;
    }

    /** 根据 URL 后缀推断 Content-Type（豆瓣海报为 webp） */
    private String mediaType(String url) {
        if (url.endsWith(".jpg") || url.endsWith(".jpeg")) return "image/jpeg";
        if (url.endsWith(".png")) return "image/png";
        return "image/webp";
    }

    private String md5(String text) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(text.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            // MD5 在所有 JDK 上都存在，理论上不会走到这里
            throw new IllegalStateException(e);
        }
    }
}
