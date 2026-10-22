package com.movie.dashboard.dto;

import java.io.Serializable;
import java.util.List;

/**
 * 分页返回对象（课程要求：分页接口 data 包含 page、size、total、records）。
 *
 * @param <T> 记录类型
 */
public class PageVO<T> implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 当前页码，从 0 开始（与请求参数一致） */
    private Integer page;

    /** 每页条数 */
    private Integer size;

    /** 总记录数 */
    private Long total;

    /** 当前页数据 */
    private List<T> records;

    public PageVO() {
    }

    public PageVO(Integer page, Integer size, Long total, List<T> records) {
        this.page = page;
        this.size = size;
        this.total = total;
        this.records = records;
    }

    public Integer getPage() {
        return page;
    }

    public void setPage(Integer page) {
        this.page = page;
    }

    public Integer getSize() {
        return size;
    }

    public void setSize(Integer size) {
        this.size = size;
    }

    public Long getTotal() {
        return total;
    }

    public void setTotal(Long total) {
        this.total = total;
    }

    public List<T> getRecords() {
        return records;
    }

    public void setRecords(List<T> records) {
        this.records = records;
    }
}
