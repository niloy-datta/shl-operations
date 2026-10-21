package com.shl.operations;

import com.shl.operations.enterprise.GrowthController;
import com.shl.operations.enterprise.LeadRoutingController;
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
class LeadRoutingWorkflowTest {
    static final PostgreSQLContainer postgres=new PostgreSQLContainer("postgres:17.6");
    static {postgres.start();}
    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry){
        registry.add("DB_URL",postgres::getJdbcUrl);
        registry.add("DB_USERNAME",postgres::getUsername);
        registry.add("DB_PASSWORD",postgres::getPassword);
    }
    @Autowired JdbcTemplate db;
    @Autowired GrowthController growth;
    @Autowired LeadRoutingController routing;

    private UUID bd(){
        UUID id=UUID.randomUUID();
        db.update("""
            INSERT INTO staff_users(id,username,password_hash,role,enabled)
            VALUES(?,?,?,'BD',true)
            """,id,"bd-"+id.toString().substring(0,10),"not-a-login-password");
        return id;
    }
    private UUID lead(){
        String suffix=UUID.randomUUID().toString();
        return (UUID)growth.addLead(new GrowthController.LeadInput(
            null,"Buyer "+suffix,"Contact","contact@example.test","MANUAL",
            "Request "+suffix,null,null,null)).getBody().get("id");
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void assignmentIsAuditedAndCannotSilentlyOverwriteOrClose(){
        UUID first=bd(),second=bd(),leadId=lead();
        assertThat(routing.queue(0,100).content())
            .anyMatch(x->leadId.equals(x.get("id")));
        assertThat(routing.assign(leadId,
            new LeadRoutingController.AssignmentInput(first,"Account allocation")).get("owner_id"))
            .isEqualTo(first);
        assertThat(routing.history(leadId)).hasSize(1);
        assertThat(routing.queue(0,100).content())
            .noneMatch(x->leadId.equals(x.get("id")));
        assertThatThrownBy(()->routing.assign(leadId,
            new LeadRoutingController.AssignmentInput(first,"Duplicate assignment")))
            .isInstanceOf(ResponseStatusException.class);
        routing.assign(leadId,
            new LeadRoutingController.AssignmentInput(second,"Manager approved transfer"));
        assertThat(routing.history(leadId)).hasSize(2);
        assertThat(routing.history(leadId))
            .anyMatch(x->first.equals(x.get("previous_owner_id"))
                && second.equals(x.get("new_owner_id")));
        Long audits=db.queryForObject("""
            SELECT count(*) FROM audit_events WHERE entity_id=? AND action='OWNER_CHANGED'
            """,Long.class,leadId);
        assertThat(audits).isEqualTo(2);
        growth.leadStatus(leadId,new GrowthController.ChangeStatus("LOST"));
        assertThatThrownBy(()->routing.assign(leadId,
            new LeadRoutingController.AssignmentInput(first,"Closed record")))
            .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @WithMockUser(username="test-admin",roles="ADMIN")
    void managerTriggeredAutoRoutingUsesRealStaffAndRejectsDisabledOwner(){
        UUID owner=bd(),queued=lead();
        assertThat(routing.workload()).anyMatch(x->owner.equals(x.get("id")));
        MapAssertCheck(routing.assignNext().getBody());
        assertThat(routing.queue(0,100).content())
            .noneMatch(x->queued.equals(x.get("id")));
        UUID second=lead();
        db.update("UPDATE staff_users SET enabled=false WHERE id=?",owner);
        assertThatThrownBy(()->routing.assign(second,
            new LeadRoutingController.AssignmentInput(owner,"Disabled staff")))
            .isInstanceOf(ResponseStatusException.class);
    }

    private void MapAssertCheck(java.util.Map<String,Object> item){
        assertThat(item).containsKeys("id","owner_id","owner_name");
        assertThat(routing.history((UUID)item.get("id"))).hasSize(1);
    }

    @Test
    @WithMockUser(username="staff-bd",roles="BD")
    void ordinaryBdCannotAdministerOwnership(){
        assertThatThrownBy(()->routing.queue(0,20)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->routing.workload()).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->routing.assignNext()).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->routing.assign(UUID.randomUUID(),
            new LeadRoutingController.AssignmentInput(UUID.randomUUID(),"Unauthorized")))
            .isInstanceOf(AccessDeniedException.class);
    }
}
