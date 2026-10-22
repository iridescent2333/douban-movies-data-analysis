package com.movie.dashboard.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI / Swagger UI 配置。
 * <p>
 * 课程技术要求「API 文档使用 Swagger/OpenAPI 自动生成」：
 * 启动后访问 <a href="http://localhost:8081/swagger-ui.html">http://localhost:8081/swagger-ui.html</a>
 * 即可查看全部接口文档并在线调试。
 * 仓库中的 {@code docs/apifox-import.json} 是同一份契约的静态副本，供 ApiFox 导入协作使用。
 * </p>
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI movieDashboardOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("豆瓣电影数据洞察看板 API")
                        .description("帮助用户发现优质作品、了解评分分布与类型趋势 —— Web 开发技术课程小组作业")
                        .version("1.0.0")
                        .license(new License().name("MIT")));
    }
}
