package com.movie.dashboard;

import java.util.Arrays;
import java.util.List;

/**
 * 全站统一的「核心类型 / 核心地区」字典。
 * <p>
 * 课程要求：类型仅保留 12 个典型类型、地区仅保留 10 个核心电影产出国家/地区，
 * 用于 A1 {@code /api/types}、筛选器下拉、分类型 / 分地区热榜、类型对比、深度分析热力矩阵，
 * 保证全站口径一致、选项不爆炸、课堂演示每个筛选 / 榜单选项都有足够数据。
 * </p>
 * <p>
 * 该字典与前端 {@code config.js} 的 {@code CORE_TYPES / CORE_REGIONS} 保持一致，
 * 修改时需前后端同步。
 * </p>
 */
public final class Constants {

    private Constants() {
    }

    /** 12 个核心电影类型（顺序即展示顺序） */
    public static final List<String> CORE_GENRES = Arrays.asList(
            "剧情", "爱情", "喜剧", "恐怖", "悬疑", "战争",
            "历史", "纪录片", "动作", "动画", "奇幻", "科幻");

    /** 10 个核心电影产出国家/地区（顺序即展示顺序） */
    public static final List<String> CORE_REGIONS = Arrays.asList(
            "中国大陆", "中国台湾", "中国香港", "美国", "日本",
            "韩国", "英国", "法国", "德国", "俄罗斯");

    public static boolean isCoreGenre(String g) {
        return g != null && CORE_GENRES.contains(g);
    }

    public static boolean isCoreRegion(String r) {
        return r != null && CORE_REGIONS.contains(r);
    }
}
