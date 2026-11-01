package com.shl.operations.enterprise;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.util.Locale;
import java.util.Set;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/logistics/consignees")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','LOGISTICS','SOURCING')")
public class ConsigneeController {
    private final JdbcTemplate db;
    private final AuditService audit;
    public ConsigneeController(JdbcTemplate db, AuditService audit) {
        this.db = db;
        this.audit = audit;
    }

    public record Input(
        @NotNull UUID customerId,
        @NotBlank @Size(max = 180) String companyName,
        @Size(max = 120) String contactName,
        @Email @Size(max = 240) String email,
        @Size(max = 60) String phone,
        @NotBlank @Pattern(regexp = "[A-Za-z]{2}") String countryCode,
        @NotBlank @Size(max = 500) String address,
        boolean active
    ) {}

    private Map<String,Object> find(UUID id) {
        return db.queryForList("""
            SELECT c.*, cu.name AS customer_name FROM consignees c
            JOIN customers cu ON cu.id=c.customer_id WHERE c.id=?
            """,id).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND,"Consignee not found"));
    }

    private static final Set<String> ISO_COUNTRIES=Set.of(Locale.getISOCountries());
    private static String country(String value) {
        String code=value.toUpperCase(Locale.ROOT);
        if (!ISO_COUNTRIES.contains(code))
            throw new ResponseStatusException(BAD_REQUEST,"Use a valid ISO 3166-1 country code");
        return code;
    }
    private static String required(String value) { return value.trim(); }
    private static String optional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    @GetMapping
    public Pages.Result list(@RequestParam(defaultValue="") String q,
        @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size,
        @RequestParam(required=false) UUID customerId) {
        String term = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        term = term.substring(0,Math.min(100,term.length()));
        String like = "%" + term + "%";
        String where=" WHERE (lower(c.code) LIKE ? OR lower(c.company_name) LIKE ? OR lower(cu.name) LIKE ?)";
        if (customerId != null) where += " AND c.customer_id = ?";
        Object[] args=customerId == null ? new Object[]{like,like,like} :
            new Object[]{like,like,like,customerId};
        return Pages.of(db,"c.*,cu.name AS customer_name",
            "FROM consignees c JOIN customers cu ON cu.id=c.customer_id",
            where,args,"ORDER BY c.created_at DESC,c.id DESC",page,size);
    }

    @GetMapping("/{id}")
    public Map<String,Object> get(@PathVariable UUID id) { return find(id); }

    @PostMapping
    @Transactional
    public ResponseEntity<Map<String,Object>> create(@Valid @RequestBody Input input) {
        if (db.queryForList("SELECT id FROM customers WHERE id=?",input.customerId()).isEmpty())
            throw new ResponseStatusException(BAD_REQUEST,"Customer does not exist");
        UUID id = UUID.randomUUID();
        String code = "CNE-" + id.toString().replace("-","").substring(0,12).toUpperCase(Locale.ROOT);
        db.update("""
            INSERT INTO consignees (id,code,customer_id,company_name,contact_name,email,phone,
                country_code,address,active,created_by)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """,id,code,input.customerId(),required(input.companyName()),optional(input.contactName()),
            optional(input.email()),optional(input.phone()),
            country(input.countryCode()),required(input.address()),input.active(),audit.actor());
        audit.log("CREATED","CONSIGNEE",id,"Customer-scoped consignee registered");
        return ResponseEntity.created(URI.create("/api/logistics/consignees/"+id)).body(find(id));
    }

    @PatchMapping("/{id}")
    @Transactional
    public Map<String,Object> update(@PathVariable UUID id,@Valid @RequestBody Input input) {
        var original=db.queryForList("SELECT customer_id FROM consignees WHERE id=? FOR UPDATE",id)
            .stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND,"Consignee not found"));
        if (!input.customerId().equals(original.get("customer_id")))
            throw new ResponseStatusException(CONFLICT,"Consignee customer ownership cannot be changed");
        db.update("""
            UPDATE consignees SET company_name=?,contact_name=?,email=?,phone=?,country_code=?,
                address=?,active=?,updated_at=now() WHERE id=?
            """,required(input.companyName()),optional(input.contactName()),optional(input.email()),
            optional(input.phone()),country(input.countryCode()),
            required(input.address()),input.active(),id);
        audit.log("UPDATED","CONSIGNEE",id,input.active()?"Profile updated":"Consignee deactivated");
        return find(id);
    }
}
