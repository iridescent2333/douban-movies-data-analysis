package com.movie.dashboard.controller;

import com.movie.dashboard.entity.Genre;
import com.movie.dashboard.exception.Result;
import com.movie.dashboard.repository.GenreRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 类型字典控制器 —— 对应课程要求接口 A1（GET /api/types）。
 */
@RestController
@RequestMapping("/api/types")
@Tag(name = "类型列表（A1）", description = "返回全部电影类型")
public class TypesController {

    @Autowired
    private GenreRepository genreRepository;

    /** A1：返回类型列表（按中文名排序） */
    @Operation(summary = "A1 类型列表", description = "返回全部电影类型，如 剧情/喜剧/科幻...")
    @GetMapping("")
    public Result<List<String>> types() {
        List<String> names = genreRepository.findAll().stream()
                .map(Genre::getName)
                .filter(n -> n != null && !n.isBlank())
                .sorted()
                .collect(Collectors.toList());
        return Result.ok(names);
    }
}
