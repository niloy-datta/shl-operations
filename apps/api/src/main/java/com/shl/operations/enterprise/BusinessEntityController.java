package com.shl.operations.enterprise;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.net.URI;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/entities")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD','SOURCING')")
public class BusinessEntityController {
    private final JdbcTemplate db;
    private final AuditService audit;
    private static final Set<String> KINDS=Set.of("CUSTOMER","SUPPLIER","PARTNER","OFFICE");
    private static final Set<String> CONTACT_ROLES=Set.of(
        "BUYING","FINANCE","LOGISTICS","MANAGEMENT","COMPLIANCE","OTHER");
    private static final Set<String> COUNTRIES=Set.of(Locale.getISOCountries());

    public BusinessEntityController(JdbcTemplate db,AuditService audit) {
        this.db=db;this.audit=audit;
    }
    public record EntityInput(
        @NotBlank String kind,UUID customerId,UUID supplierId,
        @NotBlank @Size(max=180) String legalName,
        @Size(max=160) String branchName,
        @NotBlank String countryCode,@Size(max=120) String city,
        @Size(max=240) String website,@Size(max=120) String registrationNumber,
        @NotBlank String status) {}
    public record ContactInput(
        @NotBlank @Size(max=160) String fullName,
        @Size(max=120) String positionTitle,
        @NotBlank String contactRole,
        @Email @Size(max=240) String email,
        @Size(max=60) String phone,
        boolean primary, boolean active) {}

    private static String normalized(String value) {
        return value==null?null:value.trim();
    }
    private static String nullable(String value) {
        return value==null||value.isBlank()?null:value.trim();
    }
    private void require(boolean condition,String message) {
        if(!condition)throw new ResponseStatusException(BAD_REQUEST,message);
    }
    private static String country(String code) {
        String result=code.trim().toUpperCase(Locale.ROOT);
        if(!COUNTRIES.contains(result))throw new ResponseStatusException(BAD_REQUEST,"Invalid ISO country code");
        return result;
    }
    private void validate(EntityInput input) {
        require(KINDS.contains(input.kind()),"Invalid entity kind");
        require(Set.of("ACTIVE","INACTIVE").contains(input.status()),"Invalid status");
        require(("CUSTOMER".equals(input.kind()) && input.customerId()!=null && input.supplierId()==null)
             || ("SUPPLIER".equals(input.kind()) && input.supplierId()!=null && input.customerId()==null)
             || (Set.of("OFFICE","PARTNER").contains(input.kind())
                  && input.customerId()==null && input.supplierId()==null),"Entity ownership is inconsistent");
        country(input.countryCode());
        if(input.customerId()!=null)
            require(!db.queryForList("SELECT id FROM customers WHERE id=?",input.customerId()).isEmpty(),"Unknown customer");
        if(input.supplierId()!=null)
            require(!db.queryForList("SELECT id FROM suppliers WHERE id=?",input.supplierId()).isEmpty(),"Unknown supplier");
        if(nullable(input.website())!=null) {
            try {
                URI url=URI.create(input.website());
                require("https".equalsIgnoreCase(url.getScheme()) && url.getHost()!=null
                    && url.getUserInfo()==null,"Only HTTPS website addresses are allowed");
            } catch(IllegalArgumentException e) {throw new ResponseStatusException(BAD_REQUEST,"Invalid HTTPS website");}
        }
    }
    private void validateContact(ContactInput input) {
        require(CONTACT_ROLES.contains(input.contactRole()),"Invalid contact role");
        require(nullable(input.email())!=null||nullable(input.phone())!=null,"Provide an email or phone number");
    }
    private Map<String,Object> entity(UUID id) {
        return db.queryForList("""
            SELECT e.*,cu.name AS customer_name,s.name AS supplier_name
            FROM business_entities e
            LEFT JOIN customers cu ON cu.id=e.customer_id
            LEFT JOIN suppliers s ON s.id=e.supplier_id WHERE e.id=?
            """,id).stream().findFirst()
            .orElseThrow(()->new ResponseStatusException(NOT_FOUND,"Entity not found"));
    }
    private Map<String,Object> contact(UUID id,UUID contactId) {
        return db.queryForList("""
            SELECT id,entity_id,full_name,position_title,contact_role,email,phone,
              is_primary,active,created_at,updated_at FROM business_entity_contacts
            WHERE id=? AND entity_id=?
            """,contactId,id).stream().findFirst()
            .orElseThrow(()->new ResponseStatusException(NOT_FOUND,"Contact not found"));
    }

    @GetMapping
    public Pages.Result list(@RequestParam(defaultValue="") String q,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        String term=q==null?"":q.trim().toLowerCase(Locale.ROOT);
        String like="%"+term.substring(0,Math.min(100,term.length()))+"%";
        return Pages.of(db,"e.*,cu.name AS customer_name,s.name AS supplier_name",
            "FROM business_entities e LEFT JOIN customers cu ON cu.id=e.customer_id LEFT JOIN suppliers s ON s.id=e.supplier_id",
            " WHERE lower(e.legal_name) LIKE ? OR lower(e.reference) LIKE ? OR lower(coalesce(e.branch_name,'')) LIKE ?",
            new Object[]{like,like,like},"ORDER BY e.created_at DESC,e.id DESC",page,size);
    }
    @GetMapping("/{id}")
    public Map<String,Object> get(@PathVariable UUID id){return entity(id);}

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')")
    @Transactional
    public ResponseEntity<Map<String,Object>> create(@Valid @RequestBody EntityInput input) {
        validate(input);
        UUID id=UUID.randomUUID();
        String ref="ENT-"+id.toString().replace("-","").substring(0,12).toUpperCase(Locale.ROOT);
        db.update("""
            INSERT INTO business_entities(id,reference,kind,customer_id,supplier_id,
                legal_name,branch_name,country_code,city,website,registration_number,status,created_by)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,id,ref,input.kind(),input.customerId(),input.supplierId(),
            input.legalName().trim(),nullable(input.branchName()),country(input.countryCode()),
            nullable(input.city()),nullable(input.website()),nullable(input.registrationNumber()),
            input.status(),audit.actor());
        audit.log("CREATED","BUSINESS_ENTITY",id,"Business registry entry created");
        return ResponseEntity.created(URI.create("/api/entities/"+id)).body(entity(id));
    }
    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')")
    @Transactional
    public Map<String,Object> update(@PathVariable UUID id,@Valid @RequestBody EntityInput input) {
        var original=db.queryForList("SELECT * FROM business_entities WHERE id=? FOR UPDATE",id)
            .stream().findFirst().orElseThrow(()->new ResponseStatusException(NOT_FOUND,"Entity not found"));
        validate(input);
        if(!Objects.equals(input.kind(),original.get("kind"))
            ||!Objects.equals(input.customerId(),original.get("customer_id"))
            ||!Objects.equals(input.supplierId(),original.get("supplier_id")))
            throw new ResponseStatusException(CONFLICT,"Entity ownership and kind cannot change");
        db.update("""
            UPDATE business_entities SET legal_name=?,branch_name=?,country_code=?,city=?,
              website=?,registration_number=?,status=?,updated_at=now() WHERE id=?
            """,input.legalName().trim(),nullable(input.branchName()),country(input.countryCode()),
            nullable(input.city()),nullable(input.website()),nullable(input.registrationNumber()),
            input.status(),id);
        audit.log("UPDATED","BUSINESS_ENTITY",id,"Registry entry updated");
        return entity(id);
    }
    @GetMapping("/{id}/contacts")
    public Pages.Result contacts(@PathVariable UUID id,@RequestParam(defaultValue="0") int page,
        @RequestParam(defaultValue="20") int size) {
        entity(id);
        return Pages.of(db,
            "id,entity_id,full_name,position_title,contact_role,email,phone,is_primary,active,created_at,updated_at",
            "FROM business_entity_contacts"," WHERE entity_id=?",new Object[]{id},
            "ORDER BY created_at DESC,id DESC",page,size);
    }
    @PostMapping("/{id}/contacts")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')")
    @Transactional
    public ResponseEntity<Map<String,Object>> addContact(@PathVariable UUID id,
        @Valid @RequestBody ContactInput input) {
        validateContact(input);
        entity(id);
        UUID contactId=UUID.randomUUID();
        db.update("""
            INSERT INTO business_entity_contacts
              (id,entity_id,full_name,position_title,contact_role,email,phone,is_primary,active,created_by)
            VALUES (?,?,?,?,?,?,?,?,?,?)
            """,contactId,id,input.fullName().trim(),nullable(input.positionTitle()),
            input.contactRole(),nullable(input.email()),nullable(input.phone()),
            input.primary(),input.active(),audit.actor());
        audit.log("CONTACT_CREATED","BUSINESS_ENTITY",id,"Role "+input.contactRole());
        return ResponseEntity.created(URI.create("/api/entities/"+id+"/contacts/"+contactId))
            .body(contact(id,contactId));
    }
    @PatchMapping("/{id}/contacts/{contactId}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')")
    @Transactional
    public Map<String,Object> updateContact(@PathVariable UUID id,@PathVariable UUID contactId,
        @Valid @RequestBody ContactInput input) {
        validateContact(input);
        if(db.queryForList("SELECT id FROM business_entity_contacts WHERE entity_id=? AND id=? FOR UPDATE",
            id,contactId).isEmpty()) throw new ResponseStatusException(NOT_FOUND,"Contact not found");
        db.update("""
            UPDATE business_entity_contacts SET full_name=?,position_title=?,contact_role=?,
              email=?,phone=?,is_primary=?,active=?,updated_at=now() WHERE id=?
            """,input.fullName().trim(),nullable(input.positionTitle()),input.contactRole(),
            nullable(input.email()),nullable(input.phone()),input.primary(),input.active(),contactId);
        audit.log("CONTACT_UPDATED","BUSINESS_ENTITY",id,"Role "+input.contactRole());
        return contact(id,contactId);
    }
}
