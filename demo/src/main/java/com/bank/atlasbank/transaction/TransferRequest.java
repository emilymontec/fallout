package com.bank.atlasbank.transaction;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record TransferRequest(
        @NotNull(message = "sourceAccountId es obligatorio") Long sourceAccountId,
        @NotNull(message = "targetAccountId es obligatorio") Long targetAccountId,
        @NotNull(message = "amount es obligatorio")
        @DecimalMin(value = "0.01", inclusive = true, message = "El monto debe ser mayor a cero")
        BigDecimal amount,
        String location
) {
}
