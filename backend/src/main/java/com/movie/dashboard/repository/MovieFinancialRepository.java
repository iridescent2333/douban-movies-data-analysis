package com.movie.dashboard.repository;

import com.movie.dashboard.entity.MovieFinancial;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

/**
 * 财务数据 Repository。
 */
@Repository
public interface MovieFinancialRepository extends JpaRepository<MovieFinancial, Long> {

    /**
     * 查询所有具备预算/票房数据的电影财务记录。
     * 业务含义：散点图 / 热力图等统计图表的数据源。
     */
    @Query("SELECT mf FROM MovieFinancial mf " +
           "WHERE (mf.budgetWan IS NOT NULL AND mf.budgetWan > 0) " +
           "   OR (mf.boxOfficeWan IS NOT NULL AND mf.boxOfficeWan > 0)")
    List<MovieFinancial> findAllWithBudgetOrBoxOffice();
}
