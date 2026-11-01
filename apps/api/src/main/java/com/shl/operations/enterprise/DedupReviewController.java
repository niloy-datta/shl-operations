package com.shl.operations.enterprise;

import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

/** Read-only exact-key duplicate candidates. Never modifies or merges a business record. */
@RestController
@RequestMapping("/api/dedup")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')")
public class DedupReviewController {
    private final JdbcTemplate db;
    public DedupReviewController(JdbcTemplate db){this.db=db;}

    private static final Map<String,String> SIMPLE_TABLES=Map.of(
        "customers","customers","suppliers","suppliers");
    private static final Set<String> TYPES=Set.of("customers","suppliers","consignees");

    @GetMapping("/candidates")
    public Pages.Result candidates(@RequestParam(defaultValue="customers") String entity,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        if(!TYPES.contains(entity))
            throw new ResponseStatusException(BAD_REQUEST,"Unsupported directory");
        String sql=entity.equals("consignees")?consigneeMatches():
            contactMatches(SIMPLE_TABLES.get(entity));
        return Pages.of(db,"match_type,match_key,candidate_count,member_ids",
            "FROM ("+sql+") AS candidate_groups","",new Object[]{},
            "ORDER BY candidate_count DESC,match_type ASC,match_key ASC",
            page,Math.min(50,size));
    }

    private String contactMatches(String table) {
        // Source table is from the hard-coded allowlist, never user-supplied SQL.
        return """
            SELECT 'EMAIL'::text AS match_type,lower(btrim(email)) AS match_key,
                count(*) AS candidate_count,string_agg(id::text,',' ORDER BY id::text) AS member_ids
            FROM %s
            WHERE email IS NOT NULL AND length(btrim(email))>0
            GROUP BY lower(btrim(email)) HAVING count(*)>1
            UNION ALL
            SELECT 'NAME_AND_COUNTRY'::text,
                concat(lower(btrim(name)),' | ',lower(btrim(country))),
                count(*),string_agg(id::text,',' ORDER BY id::text)
            FROM %s
            WHERE length(btrim(name))>0 AND country IS NOT NULL AND length(btrim(country))>0
            GROUP BY lower(btrim(name)),lower(btrim(country)) HAVING count(*)>1
            """.formatted(table,table);
    }

    private String consigneeMatches() {
        // Consignees are scoped to the same customer; never suggest cross-customer merges.
        return """
            SELECT 'CUSTOMER_EMAIL'::text AS match_type,
                concat(customer_id::text,' | ',lower(btrim(email))) AS match_key,
                count(*) AS candidate_count,string_agg(id::text,',' ORDER BY id::text) AS member_ids
            FROM consignees
            WHERE active=true AND email IS NOT NULL AND length(btrim(email))>0
            GROUP BY customer_id,lower(btrim(email)) HAVING count(*)>1
            UNION ALL
            SELECT 'CUSTOMER_COMPANY_ADDRESS'::text,
                concat(customer_id::text,' | ',lower(btrim(company_name)),' | ',
                       lower(btrim(address)),' | ',lower(btrim(country_code))),
                count(*),string_agg(id::text,',' ORDER BY id::text)
            FROM consignees
            WHERE active=true
            GROUP BY customer_id,lower(btrim(company_name)),lower(btrim(address)),
                     lower(btrim(country_code)) HAVING count(*)>1
            """;
    }
}
