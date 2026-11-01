package com.shl.operations.contacts;

import jakarta.validation.constraints.*;

public record ContactInput(
    @NotBlank @Size(max = 160) String name,
    @Email @Size(max = 254) String email,
    @Size(max = 60) String phone,
    @Size(max = 100) String country
) {}

