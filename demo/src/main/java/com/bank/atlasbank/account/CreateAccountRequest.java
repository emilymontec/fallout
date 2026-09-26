package com.bank.atlasbank.account;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record CreateAccountRequest(
                @NotNull(message = "customerId es obligatorio") String customerId,
                @NotNull(message = "accountType es obligatorio") AccountType accountType,
                @NotNull(message = "initialBalance es obligatorio") @DecimalMin(value = "0.0", inclusive = true, message = "Saldo inicial debe ser positivo") BigDecimal initialBalance) {
}
