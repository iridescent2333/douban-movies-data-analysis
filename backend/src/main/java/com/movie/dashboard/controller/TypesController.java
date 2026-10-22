package com.movie.dashboard.controller;

import com.movie.dashboard.exception.Result;
import com.movie.dashboard.service.MovieService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 类型字典控制器 —— 对应课程要求接口 A1（GET /api/types）。
 * <p>
 * 返回"热门且有代表性"的类型标签（按影片数降序、门槛 ≥60 部），
 * 与豆瓣/B站电影分区口径一致：剧情、喜剧、动作、爱情、科幻、动画、
 * 悬疑、惊悚、犯罪、奇幻、冒险、战争、历史、恐怖、家庭、传记 等。
 * 长尾冷门标签（数据仅个位数）不下发，避免筛选后无结果。
 * </p>
 */
@RestController
@RequestMapping("/api/types")
@Tag(name = "类型列表（A1）", description = "返回热门电影类型")
public class TypesController {

    @Autowired
    private MovieService movieService;

    /** A1：返回热门类型列表（按影片数降序） */
    @Operation(summary = "A1 类型列表", description = "返回热门电影类型（剧情/喜剧/动作/科幻...），按影片数降序")
    @GetMapping("")
    public Result<List<String>> types() {
        return Result.ok(movieService.hotGenres());
    }
}
