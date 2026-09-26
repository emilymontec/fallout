package com.bank.atlasbank.customer;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record CreateCustomerRequest(
        String customerId,
        String fullName,
        String firstName,
        String lastName,
        @Email(message = "Email invalido") String email,
        String phone,
        String password
) {
}
