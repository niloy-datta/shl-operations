package com.shl.operations.contacts;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@RestController @RequestMapping("/api")
public class ContactController {
    private final CustomerRepository customers;
    private final SupplierRepository suppliers;
    private final JdbcTemplate db;
    public ContactController(CustomerRepository customers, SupplierRepository suppliers, JdbcTemplate db) {
        this.customers = customers; this.suppliers = suppliers; this.db = db;
    }
    private PageRequest page(int index, int size) {
        return PageRequest.of(Math.max(0, index), Math.min(100, Math.max(1, size)), Sort.by(Sort.Direction.DESC, "createdAt"));
    }
    @GetMapping("/customers") public Page<Customer> customers(@RequestParam(defaultValue = "") String q,
        @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return customers.findByNameContainingIgnoreCase(q, page(page, size));
    }
    @PostMapping("/customers") @Transactional public ResponseEntity<Customer> createCustomer(@Valid @RequestBody ContactInput input) {
        Customer saved = customers.save(new Customer(input));
        return ResponseEntity.created(URI.create("/api/customers/" + saved.id)).body(saved);
    }
    @PutMapping("/customers/{id}") @Transactional public Customer updateCustomer(@PathVariable UUID id, @Valid @RequestBody ContactInput input) {
        Customer saved = customers.findById(id).orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
        saved.update(input); return saved;
    }
    @GetMapping("/suppliers") public Page<Supplier> suppliers(@RequestParam(defaultValue = "") String q,
        @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return suppliers.findByNameContainingIgnoreCase(q, page(page, size));
    }
    @PostMapping("/suppliers") @Transactional public ResponseEntity<Supplier> createSupplier(@Valid @RequestBody ContactInput input) {
        Supplier saved = suppliers.save(new Supplier(input));
        return ResponseEntity.created(URI.create("/api/suppliers/" + saved.id)).body(saved);
    }
    @PutMapping("/suppliers/{id}") @Transactional public Supplier updateSupplier(@PathVariable UUID id, @Valid @RequestBody ContactInput input) {
        Supplier saved = suppliers.findById(id).orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
        saved.update(input); return saved;
    }
    @GetMapping("/dashboard") public Map<String, Long> dashboard() {
        return Map.of("customers", customers.count(), "suppliers", suppliers.count(),
            "rfqs", db.queryForObject("SELECT count(*) FROM rfqs", Long.class));
    }
}
