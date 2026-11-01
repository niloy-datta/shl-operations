package com.shl.operations.contacts;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupplierRepository extends JpaRepository<Supplier, UUID> {
    Page<Supplier> findByNameContainingIgnoreCase(String name, Pageable page);
}

