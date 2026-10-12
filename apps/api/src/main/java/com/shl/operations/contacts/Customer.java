package com.shl.operations.contacts;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "customers")
public class Customer {
    @Id public UUID id;
    @Column(nullable = false, length = 160) public String name;
    @Column(length = 254) public String email;
    @Column(length = 60) public String phone;
    @Column(length = 100) public String country;
    @Column(name = "created_at", nullable = false) public Instant createdAt;
    protected Customer() {}
    public Customer(ContactInput input) { id = UUID.randomUUID(); createdAt = Instant.now(); update(input); }
    public void update(ContactInput input) {
        name = input.name().trim(); email = input.email(); phone = input.phone(); country = input.country();
    }
}

