package com.shl.operations;

import com.shl.operations.enterprise.DedupReviewController;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.postgresql.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={
    "BOOTSTRAP_ADMIN_USERNAME=test-admin",
    "BOOTSTRAP_ADMIN_PASSWORD=unique-test-password-123456"
})
class DedupReviewWorkflowTest {
    static final PostgreSQLContainer postgres=new PostgreSQLContainer("postgres:17.6");
    static {postgres.start();}
    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry){
        registry.add("DB_URL",postgres::getJdbcUrl);
        registry.add("DB_USERNAME",postgres::getUsername);
        registry.add("DB_PASSWORD",postgres::getPassword);
    }
    @Autowired JdbcTemplate db;
    @Autowired DedupReviewController review;

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void exactEmailAndNameCandidatesAreReadOnly() {
        UUID first=UUID.randomUUID(),second=UUID.randomUUID();
        String email="duplicates-"+UUID.randomUUID()+"@example.test";
        db.update("INSERT INTO customers(id,name,email,country) VALUES(?,?,?,?)",
            first,"Same Buyer",email,"BD");
        db.update("INSERT INTO customers(id,name,email,country) VALUES(?,?,?,?)",
            second,"same buyer"," "+email.toUpperCase()+" ","bd");
        var rows=review.candidates("customers",0,50).content();
        assertThat(rows).anyMatch(x->"EMAIL".equals(x.get("match_type"))
            && ((String)x.get("member_ids")).contains(first.toString())
                && ((String)x.get("member_ids")).contains(second.toString()));
        assertThat(rows).anyMatch(x->"NAME_AND_COUNTRY".equals(x.get("match_type")));
        assertThat(db.queryForObject("SELECT count(*) FROM customers WHERE id IN (?,?)",
            Long.class,first,second)).isEqualTo(2);
        assertThatThrownBy(()->review.candidates("arbitrary_sql",0,20))
            .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void sameConsigneeContactFromDifferentCustomersIsNeverReportedTogether(){
        UUID first=UUID.randomUUID(),second=UUID.randomUUID();
        db.update("INSERT INTO customers(id,name,country) VALUES(?,?,?)",
            first,"Buyer A "+first,"CN");
        db.update("INSERT INTO customers(id,name,country) VALUES(?,?,?)",
            second,"Buyer B "+second,"CN");
        for(UUID owner:new UUID[]{first,second}){
            UUID id=UUID.randomUUID();
            db.update("""
                INSERT INTO consignees(id,code,customer_id,company_name,email,country_code,address,created_by)
                VALUES(?,?,?,?,?,?,?,?)
                """,id,"CNE-"+id.toString().replace("-","").substring(0,12),
                owner,"Shared Broker","broker@example.test","CN","China Port","test-admin");
        }
        assertThat(review.candidates("consignees",0,50).content())
            .noneMatch(x->String.valueOf(x.get("match_key")).contains("broker@example.test"));
    }

    @Test
    @WithMockUser(username="bd-user",roles="BD")
    void bdCannotInspectSensitiveDuplicateCandidates(){
        assertThatThrownBy(()->review.candidates("customers",0,20))
            .isInstanceOf(AccessDeniedException.class);
    }
}
