package com.movie.dashboard;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ConfigurableApplicationContext;

/**
 * 豆瓣电影数据洞察看板 - 启动类。
 * <p>
 * 课程作业后端入口：引导 Spring Boot 容器启动、装配 JPA 数据源，
 * 由 {@code DataInitializer} 完成首次数据加载，最终对外开放 {@code /api/**} REST 接口。
 * </p>
 */
@SpringBootApplication
public class MovieDashboardApplication {

    private static final Logger log = LoggerFactory.getLogger(MovieDashboardApplication.class);

    public static void main(String[] args) {
        ConfigurableApplicationContext ctx = SpringApplication.run(MovieDashboardApplication.class, args);
        // 从运行环境读取实际端口（支持 SERVER_PORT 环境变量 / application.yml 配置）
        String port = ctx.getEnvironment().getProperty("server.port", "8081");
        log.info("=========================================================");
        log.info("  豆瓣电影数据洞察看板 后端已启动");
        log.info("  API 基地址 : http://localhost:{}/api", port);
        log.info("  健康检查   : http://localhost:{}/api/movies/filters", port);
        log.info("  （前端请通过 Nginx 访问 http://localhost/ ，勿直连本端口）");
        log.info("=========================================================");
    }
}
