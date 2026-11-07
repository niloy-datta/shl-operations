package com.shl.operations;
import com.shl.operations.enterprise.WorkspaceOverviewController;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
@SpringBootTest(properties={"BOOTSTRAP_ADMIN_USERNAME=nexus-test-admin","BOOTSTRAP_ADMIN_PASSWORD=synthetic-nexus-password"})
class WorkspaceOverviewTest {
 static final PostgreSQLContainer postgres=new PostgreSQLContainer("postgres:17.6");static{postgres.start();}
 @DynamicPropertySource static void database(DynamicPropertyRegistry r){r.add("DB_URL",postgres::getJdbcUrl);r.add("DB_USERNAME",postgres::getUsername);r.add("DB_PASSWORD",postgres::getPassword);}
 @Autowired WorkspaceOverviewController overview;@Autowired JdbcTemplate db;
 UUID staff(String username){UUID id=UUID.randomUUID();db.update("INSERT INTO staff_users(id,username,password_hash,role,enabled) VALUES (?,?,'unused-synthetic-hash','BD',true)",id,username);return id;}
 UUID task(UUID user,String title){UUID id=UUID.randomUUID();db.update("INSERT INTO work_tasks(id,title,assignee_id,priority,status) VALUES (?,?,?,'HIGH','TODO')",id,title,user);return id;}
 @SuppressWarnings("unchecked") List<WorkspaceOverviewController.Item> items(Map<String,Object> r,String key){return (List<WorkspaceOverviewController.Item>)r.get(key);}
 @Test @WithMockUser(username="nexus-bd",roles="BD") void personalTasksAndLeadsAreOwnerScoped(){
  UUID own=staff("nexus-bd"),other=staff("nexus-other"),task=task(own,"Own synthetic task"),secret=task(other,"Other synthetic task");
  UUID lead=UUID.randomUUID();db.update("INSERT INTO crm_leads(id,reference,company_name,contact_name,source,subject,owner_id,created_by) VALUES (?,?,?,'Contact','MANUAL','Private follow up',?,'seed')",lead,"L-"+lead.toString().substring(0,8),"Other buyer",other);
  var result=overview.overview("personal");assertThat(items(result,"priorities")).extracting(WorkspaceOverviewController.Item::id).contains(task.toString()).doesNotContain(secret.toString(),lead.toString());
  assertThatThrownBy(()->overview.overview("team")).isInstanceOf(ResponseStatusException.class).satisfies(e->assertThat(((ResponseStatusException)e).getStatusCode().value()).isEqualTo(403));
  assertThat(items(result,"approvals")).isEmpty();assertThat(items(result,"shipments")).isEmpty();
 }
 @Test @WithMockUser(username="nexus-logistics",roles="LOGISTICS") void logisticsReceivesNoCommercialPipelineOrFinancialFields(){
  var result=overview.overview("personal");assertThat(result.toString()).doesNotContain("gross_contribution","unit_price","commission","outstanding");
  @SuppressWarnings("unchecked") var stages=(List<WorkspaceOverviewController.Stage>)result.get("pipeline");
  assertThat(stages).extracting(WorkspaceOverviewController.Stage::key).containsExactly("shipment","delivery");
  assertThat(items(result,"approvals")).isEmpty();assertThatThrownBy(()->overview.overview("team")).isInstanceOf(ResponseStatusException.class);
 }
 @Test @WithMockUser(username="nexus-manager",roles="MANAGEMENT") void managersMustRequestTeamScopeAndCannotReviewTheirOwnQuote(){
  UUID user=staff("nexus-team-owner"),id=task(user,"Team synthetic task");
  assertThat(items(overview.overview("personal"),"priorities")).extracting(WorkspaceOverviewController.Item::id).doesNotContain(id.toString());
  assertThat(items(overview.overview("team"),"priorities")).extracting(WorkspaceOverviewController.Item::id).contains(id.toString());
  UUID customer=UUID.randomUUID(),rfq=UUID.randomUUID();db.update("INSERT INTO customers(id,name) VALUES (?,'Nexus buyer')",customer);
  db.update("INSERT INTO rfqs(id,reference,customer_id,subject,quantity,unit,currency) VALUES (?, ?, ?, 'Nexus request',1,'PCS','USD')",rfq,"RFQ-"+rfq.toString().substring(0,8),customer);
  for(String author:List.of("nexus-manager","independent-author"))db.update("INSERT INTO customer_line_quotes(id,rfq_id,version,currency,status,total_cost,total_sell,gross_contribution,created_by) VALUES (?,?,?,'USD','SUBMITTED',10,12,2,?)",UUID.randomUUID(),rfq,author.equals("nexus-manager")?1:2,author);
  assertThat(items(overview.overview("team"),"approvals")).extracting(WorkspaceOverviewController.Item::owner).contains("independent-author").doesNotContain("nexus-manager");
 }
}
