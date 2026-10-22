package com.movie.dashboard.controller;

import com.movie.dashboard.Constants;
import com.movie.dashboard.exception.Result;
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
 * 返回全站统一的 12 个核心电影类型（剧情、爱情、喜剧、恐怖、悬疑、战争、
 * 历史、纪录片、动作、动画、奇幻、科幻），顺序固定。
 * 与前端筛选下拉、分类型热榜、类型对比图表、深度分析维度完全一致。
 * </p>
 */
@RestController
@RequestMapping("/api/types")
@Tag(name = "类型列表（A1）", description = "返回核心电影类型")
public class TypesController {

    /** A1：返回 12 个核心类型列表（顺序固定） */
    @Operation(summary = "A1 类型列表", description = "返回 12 个核心电影类型（剧情/爱情/喜剧/恐怖/悬疑/战争/历史/纪录片/动作/动画/奇幻/科幻）")
    @GetMapping("")
    public Result<List<String>> types() {
        return Result.ok(Constants.CORE_GENRES);
    }
}
