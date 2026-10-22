package com.movie.dashboard.dto;

import java.util.List;

/**
 * 分页结果统一封装（课程要求：分页接口 data 包含 page、size、total、records）。
 *
 * @param <T> 记录类型
 */
public class PageResult<T> {

    /** 当前页码（0-based，与请求参数一致） */
    private int page;

    /** 每页条数 */
    private int size;

    /** 总记录数 */
    private long total;

    /** 当前页记录 */
    private List<T> records;

    public PageResult() {
    }

    public PageResult(int page, int size, long total, List<T> records) {
        this.page = page;
        this.size = size;
        this.total = total;
        this.records = records;
    }

    /** 便捷工厂 */
    public static <T> PageResult<T> of(List<T> records, int page, int size, long total) {
        return new PageResult<>(page, size, total, records);
    }

    public int getPage() {
        return page;
    }

    public void setPage(int page) {
        this.page = page;
    }

    public int getSize() {
        return size;
    }

    public void setSize(int size) {
        this.size = size;
    }

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }

    public List<T> getRecords() {
        return records;
    }

    public void setRecords(List<T> records) {
        this.records = records;
    }
}
