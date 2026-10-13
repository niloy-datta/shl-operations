package com.shl.operations.enterprise;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;

public final class Pages {
    private Pages() {}
    public record Result(List<Map<String, Object>> content, long totalElements, int totalPages) {}
    public static Result of(JdbcTemplate db, String select, String from, String where,
        Object[] args, String order, int page, int size) {
        int p = Math.max(0, page);
        int s = Math.max(1, Math.min(100, size));
        Long count = db.queryForObject("SELECT count(*) " + from + where, Long.class, args);
        Object[] bounded = java.util.Arrays.copyOf(args, args.length + 2);
        bounded[args.length] = s;
        bounded[args.length + 1] = (long) p * s;
        var rows = db.queryForList("SELECT " + select + " " + from + where + " " + order + " LIMIT ? OFFSET ?", bounded);
        long total = count == null ? 0 : count;
        return new Result(rows, total, (int) ((total + s - 1) / s));
    }
}
