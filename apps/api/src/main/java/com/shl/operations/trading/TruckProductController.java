package com.shl.operations.trading;

import com.shl.operations.enterprise.AuditService;
import com.shl.operations.enterprise.Pages;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Catalog facts are entered by staff; the service does not infer specifications or certification. */
@RestController
@RequestMapping("/api/products")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','BD','SOURCING')")
public class TruckProductController {
    private final JdbcTemplate db;
    private final AuditService audit;
    public TruckProductController(JdbcTemplate db, AuditService audit) { this.db=db; this.audit=audit; }

    public record Category(UUID id, UUID parentId, String slug, String name, boolean active) {}
    public record Manufacturer(UUID id, String name, String country, String website) {}
    public record SpecTemplate(UUID id, String fieldKey, String label, String unit, String dataType, boolean required) {}
    public record SpecInput(@NotBlank @Size(max=80) String fieldKey, @NotBlank @Size(max=120) String label,
        @NotBlank @Size(max=500) String value, @Size(max=40) String unit) {}
    public record MarketNote(@NotBlank @Size(max=100) String country, @NotBlank @Size(max=1000) String note) {}
    public record DocumentRef(@NotBlank @Size(max=160) String label, @NotBlank @Size(max=1000) String reference,
        @Size(max=80) String mediaType) {}
    public record ProductInput(@NotNull UUID categoryId, UUID manufacturerId,
        @Size(max=100) String modelCode, @NotBlank @Size(max=160) String modelName,
        @Size(max=120) String brand, @Size(max=3000) String description,
        @Size(max=60) List<@Valid SpecInput> specifications,
        @Size(max=30) List<@NotBlank @Size(max=180) String> applications,
        @Size(max=30) List<@NotBlank @Size(max=180) String> configurations,
        @Size(max=30) List<@Valid MarketNote> marketNotes,
        @Size(max=30) List<@Valid DocumentRef> documents,
        @Size(max=50) List<@NotNull UUID> supplierIds) {}
    public record Product(UUID id, UUID categoryId, String category, UUID manufacturerId,
        String manufacturer, String modelCode, String modelName, String brand, String description,
        String status, String createdBy, String approvedBy, java.time.Instant approvedAt,
        java.time.Instant createdAt, java.time.Instant updatedAt) {}
    public record ProductDetail(Product product, List<Map<String,Object>> specifications,
        List<String> applications, List<String> configurations, List<Map<String,Object>> marketNotes,
        List<Map<String,Object>> documents, List<Map<String,Object>> suppliers) {}
    public record CategoryInput(@NotBlank @Size(max=120) String name, UUID parentId) {}
    public record ManufacturerInput(@NotBlank @Size(max=160) String name, @Size(max=100) String country,
        @Size(max=500) String website) {}
    public record HistoryRow(UUID id,String actor,String action,Map<String,Object> details,java.time.Instant createdAt) {}

    private String actor(){return SecurityContextHolder.getContext().getAuthentication().getName();}
    private static String clean(String s){return s==null||s.isBlank()?null:s.trim();}
    private static Product map(ResultSet r,int n)throws SQLException{return new Product(r.getObject("id",UUID.class),
        r.getObject("category_id",UUID.class),r.getString("category"),r.getObject("manufacturer_id",UUID.class),
        r.getString("manufacturer"),r.getString("model_code"),r.getString("model_name"),r.getString("brand"),
        r.getString("description"),r.getString("status"),r.getString("created_by"),r.getString("approved_by"),
        r.getTimestamp("approved_at")==null?null:r.getTimestamp("approved_at").toInstant(),
        r.getTimestamp("created_at").toInstant(),r.getTimestamp("updated_at").toInstant());}
    private static final String PRODUCT_SELECT="""
        SELECT p.id,p.category_id,c.name AS category,p.manufacturer_id,m.name AS manufacturer,
          p.model_code,p.model_name,p.brand,p.description,p.status,p.created_by,p.approved_by,
          p.approved_at,p.created_at,p.updated_at
        FROM truck_products p JOIN truck_product_categories c ON c.id=p.category_id
        LEFT JOIN truck_manufacturers m ON m.id=p.manufacturer_id
        """;
    private Product require(UUID id){return db.query(PRODUCT_SELECT+" WHERE p.id=?",TruckProductController::map,id)
        .stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Product not found"));}
    private void history(UUID id,String action,String detail){
        Product current=require(id);
        db.update("""
            INSERT INTO truck_product_history(product_id,actor,action,details)
            VALUES(?,?,?,jsonb_build_object('summary',?::text,'modelName',?::text,'category',?::text,'manufacturer',?::text,
              'modelCode',?::text,'brand',?::text,'description',?::text,'status',?::text))
            """,id,actor(),action,detail,current.modelName(),current.category(),current.manufacturer(),
            current.modelCode(),current.brand(),current.description(),current.status());
        audit.log("TRUCK_PRODUCT_"+action,"TRUCK_PRODUCT",id,detail);
    }
    private void validateReferences(ProductInput in){
        if(db.queryForObject("SELECT count(*) FROM truck_product_categories WHERE id=? AND active",Integer.class,in.categoryId())!=1)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown or inactive category");
        if(in.manufacturerId()!=null&&db.queryForObject("SELECT count(*) FROM truck_manufacturers WHERE id=?",Integer.class,in.manufacturerId())!=1)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown manufacturer");
        for(UUID supplier:new HashSet<>(in.supplierIds()==null?List.of():in.supplierIds()))
            if(db.queryForObject("SELECT count(*) FROM suppliers WHERE id=?",Integer.class,supplier)!=1)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown supplier");
    }
    private void replaceDetails(UUID id,ProductInput in){
        db.update("DELETE FROM truck_product_spec_values WHERE product_id=?",id);
        db.update("DELETE FROM truck_product_applications WHERE product_id=?",id);
        db.update("DELETE FROM truck_product_configurations WHERE product_id=?",id);
        db.update("DELETE FROM truck_product_market_notes WHERE product_id=?",id);
        db.update("DELETE FROM truck_product_document_refs WHERE product_id=?",id);
        db.update("DELETE FROM truck_product_suppliers WHERE product_id=?",id);
        Set<String> keys=new HashSet<>();
        for(SpecInput s:in.specifications()==null?List.<SpecInput>of():in.specifications()){
            String key=s.fieldKey().trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]","-");
            if(key.isBlank()||!keys.add(key))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Specification field keys must be unique");
            UUID template=db.query("SELECT id FROM truck_spec_templates WHERE category_id=? AND field_key=? OR category_id IS NULL AND field_key=?",
                (r,n)->r.getObject(1,UUID.class),in.categoryId(),key,key).stream().findFirst().orElse(null);
            db.update("INSERT INTO truck_product_spec_values(product_id,template_id,field_key,label,value,unit) VALUES(?,?,?,?,?,?)",
                id,template,key,s.label().trim(),s.value().trim(),clean(s.unit()));
        }
        for(String item:distinct(in.applications()))db.update("INSERT INTO truck_product_applications VALUES(?,?)",id,item.trim());
        for(String item:distinct(in.configurations()))db.update("INSERT INTO truck_product_configurations VALUES(?,?)",id,item.trim());
        if(in.marketNotes()!=null)for(MarketNote item:in.marketNotes())db.update("INSERT INTO truck_product_market_notes(product_id,country,note) VALUES(?,?,?)",id,item.country().trim(),item.note().trim());
        if(in.documents()!=null)for(DocumentRef item:in.documents()){
            String ref=item.reference().trim();
            if(!(ref.startsWith("https://")||ref.startsWith("http://")||ref.startsWith("/")))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Document reference must be an HTTPS URL or internal path");
            db.update("INSERT INTO truck_product_document_refs(product_id,label,reference,media_type) VALUES(?,?,?,?)",id,item.label().trim(),ref,clean(item.mediaType()));
        }
        if(in.supplierIds()!=null)for(UUID supplier:new HashSet<>(in.supplierIds()))db.update("INSERT INTO truck_product_suppliers(product_id,supplier_id) VALUES(?,?)",id,supplier);
    }
    private static List<String> distinct(List<String> values){return values==null?List.of():values.stream().map(String::trim).filter(s->!s.isEmpty()).distinct().toList();}

    @GetMapping("/categories") public List<Category> categories(){return db.query("SELECT id,parent_id,slug,name,active FROM truck_product_categories WHERE active ORDER BY parent_id NULLS FIRST,name",
        (r,n)->new Category(r.getObject("id",UUID.class),r.getObject("parent_id",UUID.class),r.getString("slug"),r.getString("name"),r.getBoolean("active")));}
    @PostMapping("/categories") @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')") @Transactional
    public Category addCategory(@Valid @RequestBody CategoryInput input){
        String slug=input.name().trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+","-").replaceAll("^-|-$","");
        if(slug.isBlank())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Category name must include a letter or number");
        if(db.queryForObject("SELECT count(*) FROM truck_product_categories WHERE slug=?",Integer.class,slug)>0)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Category already exists");
        if(input.parentId()!=null&&db.queryForObject("SELECT count(*) FROM truck_product_categories WHERE id=? AND active",Integer.class,input.parentId())!=1)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown parent category");
        UUID id=UUID.randomUUID();db.update("INSERT INTO truck_product_categories(id,parent_id,slug,name) VALUES(?,?,?,?)",id,input.parentId(),slug,input.name().trim());
        return db.query("SELECT id,parent_id,slug,name,active FROM truck_product_categories WHERE id=?",(r,n)->new Category(id,r.getObject("parent_id",UUID.class),r.getString("slug"),r.getString("name"),r.getBoolean("active")),id).get(0);
    }
    @GetMapping("/manufacturers") public List<Manufacturer> manufacturers(@RequestParam(defaultValue="") String q){
        String term="%"+q.trim().substring(0,Math.min(q.trim().length(),100))+"%";
        return db.query("SELECT id,name,country,website FROM truck_manufacturers WHERE lower(name) LIKE lower(?) ORDER BY name LIMIT 200",
            (r,n)->new Manufacturer(r.getObject("id",UUID.class),r.getString("name"),r.getString("country"),r.getString("website")),term);
    }
    @PostMapping("/manufacturers") @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','SOURCING')") @Transactional
    public Manufacturer addManufacturer(@Valid @RequestBody ManufacturerInput input){
        if(db.queryForObject("SELECT count(*) FROM truck_manufacturers WHERE lower(name)=lower(?)",Integer.class,input.name().trim())>0)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Manufacturer already exists");
        UUID id=UUID.randomUUID();db.update("INSERT INTO truck_manufacturers(id,name,country,website) VALUES(?,?,?,?)",id,input.name().trim(),clean(input.country()),clean(input.website()));
        audit.log("TRUCK_MANUFACTURER_CREATED","TRUCK_MANUFACTURER",id,input.name());
        return new Manufacturer(id,input.name().trim(),clean(input.country()),clean(input.website()));
    }
    @GetMapping("/templates") public List<SpecTemplate> templates(@RequestParam UUID categoryId){
        return db.query("SELECT id,field_key,label,unit,data_type,required FROM truck_spec_templates WHERE category_id=? OR category_id IS NULL ORDER BY sort_order,label",
            (r,n)->new SpecTemplate(r.getObject("id",UUID.class),r.getString("field_key"),r.getString("label"),r.getString("unit"),r.getString("data_type"),r.getBoolean("required")),categoryId);
    }

    @GetMapping public Pages.Result list(@RequestParam(defaultValue="") String q,@RequestParam(required=false) UUID categoryId,
        @RequestParam(defaultValue="") String status,@RequestParam(defaultValue="modelName") String sort,
        @RequestParam(defaultValue="asc") String direction,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){
        String where=" WHERE (lower(p.model_name) LIKE lower(?) OR lower(coalesce(p.brand,'')) LIKE lower(?) OR lower(coalesce(m.name,'')) LIKE lower(?) OR lower(coalesce(p.model_code,'')) LIKE lower(?))";
        List<Object> args=new ArrayList<>();String needle="%"+q.trim().substring(0,Math.min(q.trim().length(),100))+"%";Collections.addAll(args,needle,needle,needle,needle);
        if(categoryId!=null){where+=" AND (p.category_id=? OR c.parent_id=?)";args.add(categoryId);args.add(categoryId);}
        if(!status.isBlank()){if(!Set.of("DRAFT","ACTIVE","ARCHIVED").contains(status))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid status filter");where+=" AND p.status=?";args.add(status);}
        String orderColumn=switch(sort){case "category"->"c.name";case "manufacturer"->"m.name";case "updatedAt"->"p.updated_at";default->"p.model_name";};
        String order="ORDER BY "+orderColumn+("desc".equalsIgnoreCase(direction)?" DESC":" ASC")+",p.id";
        return Pages.of(db,"p.id,p.category_id,c.name AS category,p.manufacturer_id,m.name AS manufacturer,p.model_code,p.model_name,p.brand,p.description,p.status,p.created_by,p.approved_by,p.approved_at,p.created_at,p.updated_at",
            "FROM truck_products p JOIN truck_product_categories c ON c.id=p.category_id LEFT JOIN truck_manufacturers m ON m.id=p.manufacturer_id",where,args.toArray(),order,page,size);
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) @Transactional @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','SOURCING')")
    public Product create(@Valid @RequestBody ProductInput in){validateReferences(in);UUID id=UUID.randomUUID();
        requireUniqueModel(in,null);
        db.update("INSERT INTO truck_products(id,category_id,manufacturer_id,model_code,model_name,brand,description,created_by) VALUES(?,?,?,?,?,?,?,?)",
            id,in.categoryId(),in.manufacturerId(),clean(in.modelCode()),in.modelName().trim(),clean(in.brand()),clean(in.description()),actor());
        replaceDetails(id,in);history(id,"CREATED","Draft product created");return require(id);}
    @GetMapping("/{id}") public ProductDetail detail(@PathVariable UUID id){Product p=require(id);
        return new ProductDetail(p,db.queryForList("SELECT field_key AS \"fieldKey\",label,value,unit FROM truck_product_spec_values WHERE product_id=? ORDER BY label",id),
            db.query("SELECT application FROM truck_product_applications WHERE product_id=? ORDER BY application",(r,n)->r.getString(1),id),
            db.query("SELECT configuration FROM truck_product_configurations WHERE product_id=? ORDER BY configuration",(r,n)->r.getString(1),id),
            db.queryForList("SELECT country,note FROM truck_product_market_notes WHERE product_id=? ORDER BY country",id),
            db.queryForList("SELECT id,label,reference,media_type AS \"mediaType\" FROM truck_product_document_refs WHERE product_id=? ORDER BY label",id),
            db.queryForList("SELECT s.id,s.name,s.country FROM truck_product_suppliers ps JOIN suppliers s ON s.id=ps.supplier_id WHERE ps.product_id=? ORDER BY s.name",id));}
    @PutMapping("/{id}") @Transactional @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','SOURCING')")
    public Product update(@PathVariable UUID id,@Valid @RequestBody ProductInput in){Product before=require(id);if(!"DRAFT".equals(before.status()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Only draft products can be edited; create a new draft for a changed model");validateReferences(in);
        requireUniqueModel(in,id);
        db.update("UPDATE truck_products SET category_id=?,manufacturer_id=?,model_code=?,model_name=?,brand=?,description=?,updated_at=now() WHERE id=?",in.categoryId(),in.manufacturerId(),clean(in.modelCode()),in.modelName().trim(),clean(in.brand()),clean(in.description()),id);
        replaceDetails(id,in);history(id,"UPDATED","Draft product details updated");return require(id);}
    @PostMapping("/{id}/approve") @Transactional @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')")
    public Product approve(@PathVariable UUID id){Product p=require(id);if(!"DRAFT".equals(p.status()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Only draft products can be approved");
        if(p.createdBy().equals(actor()))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Product creator cannot approve their own draft");
        if(db.queryForObject("SELECT count(*) FROM truck_product_spec_values WHERE product_id=?",Integer.class,id)==0)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Add at least one sourced specification before approval");
        db.update("UPDATE truck_products SET status='ACTIVE',approved_by=?,approved_at=now(),updated_at=now() WHERE id=?",actor(),id);history(id,"APPROVED","Independent approval recorded");return require(id);}
    @PostMapping("/{id}/archive") @Transactional @PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT')")
    public Product archive(@PathVariable UUID id){Product p=require(id);if(!"ACTIVE".equals(p.status()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Only active products can be archived");
        db.update("UPDATE truck_products SET status='ARCHIVED',updated_at=now() WHERE id=?",id);history(id,"ARCHIVED","Product archived");return require(id);}
    @GetMapping("/{id}/history") public List<HistoryRow> history(@PathVariable UUID id){require(id);return db.query("SELECT id,actor,action,details,created_at FROM truck_product_history WHERE product_id=? ORDER BY created_at DESC LIMIT 100",
        (r,n)->new HistoryRow(r.getObject("id",UUID.class),r.getString("actor"),r.getString("action"),Map.of("summary",Objects.toString(r.getString("details"),"{}")),r.getTimestamp("created_at").toInstant()),id);}
    @GetMapping("/{id}/quotes") public List<Map<String,Object>> quotes(@PathVariable UUID id){require(id);return db.queryForList("""
        SELECT r.reference AS rfq_reference,r.subject,r.currency,s.name AS supplier,p.revision_number,p.unit_price,p.moq,p.lead_days,p.incoterm,p.port,p.created_at
        FROM rfq_line_offer_revisions p JOIN rfq_line_items i ON i.id=p.item_id
        JOIN rfqs r ON r.id=p.rfq_id JOIN suppliers s ON s.id=p.supplier_id
        WHERE i.truck_product_id=? ORDER BY p.created_at DESC LIMIT 100
        """,id);}
    @GetMapping("/compare") public List<ProductDetail> compare(@RequestParam List<UUID> ids){
        if(ids.size()<2||ids.size()>4||new HashSet<>(ids).size()!=ids.size())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose 2 to 4 distinct products");
        List<ProductDetail> products=ids.stream().map(this::detail).toList();
        if(products.stream().anyMatch(d->!"ACTIVE".equals(d.product().status())))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Only active products can be compared");
        return products;
    }
    private void requireUniqueModel(ProductInput in,UUID exceptId){
        if(in.modelCode()==null||in.manufacturerId()==null)return;
        Integer count=exceptId==null?db.queryForObject("SELECT count(*) FROM truck_products WHERE manufacturer_id=? AND lower(model_code)=lower(?)",Integer.class,in.manufacturerId(),in.modelCode().trim()):
            db.queryForObject("SELECT count(*) FROM truck_products WHERE manufacturer_id=? AND lower(model_code)=lower(?) AND id<>?",Integer.class,in.manufacturerId(),in.modelCode().trim(),exceptId);
        if(count!=null&&count>0)throw new ResponseStatusException(HttpStatus.CONFLICT,"This manufacturer model code already exists");
    }
}
