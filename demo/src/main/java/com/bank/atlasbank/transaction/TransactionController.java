package com.bank.atlasbank.transaction;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    private final TransactionService service;

    public TransactionController(TransactionService service) {
        this.service = service;
    }

    @PostMapping("/deposit/{accountId}")
    public BankTransaction deposit(@PathVariable Long accountId, @Valid @RequestBody AmountRequest request) {
        return service.deposit(accountId, request.amount());
    }

    @PostMapping("/withdraw/{accountId}")
    public BankTransaction withdraw(@PathVariable Long accountId, @Valid @RequestBody AmountRequest request) {
        return service.withdraw(accountId, request.amount());
    }

    @PostMapping("/transfer")
    public BankTransaction transfer(@Valid @RequestBody TransferRequest request) {
        return service.transfer(request);
    }

    @GetMapping
    public List<BankTransaction> findAll() {
        return service.findAll();
    }
}
