package com.bank.atlasbank.customer;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record UpdateCustomerProfileRequest(
        @NotBlank(message = "fullName es obligatorio") String fullName,
        @NotBlank(message = "email es obligatorio") @Email(message = "Email invalido") String email,
        @NotBlank(message = "phone es obligatorio") String phone
) {
}
