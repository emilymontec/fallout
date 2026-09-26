package com.bank.atlasbank.account;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    private final AccountService service;

    public AccountController(AccountService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Account create(@Valid @RequestBody CreateAccountRequest request) {
        return service.create(request);
    }

    @GetMapping
    public List<Account> findAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public Account findById(@PathVariable Long id) {
        return service.findById(id);
    }

    @GetMapping("/customer/{customerId}")
    public List<Account> findByCustomer(@PathVariable String customerId) {
        return service.findByCustomerId(customerId);
    }
}
