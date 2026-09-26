package com.bank.atlasbank.account;

import com.bank.atlasbank.common.exception.BusinessException;
import com.bank.atlasbank.customer.Customer;
import com.bank.atlasbank.customer.CustomerService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class AccountService {

    private static final Logger log = LoggerFactory.getLogger(AccountService.class);

    private final AccountRepository repository;
    private final CustomerService customerService;

    public AccountService(AccountRepository repository, CustomerService customerService) {
        this.repository = repository;
        this.customerService = customerService;
    }

    @Transactional
    public Account create(CreateAccountRequest request) {
        log.info("Procesando apertura de cuenta para cliente: {}", request.customerId());
        Customer customer = customerService.findByCustomerId(request.customerId());

        Account account = new Account();
        account.setCustomer(customer);
        account.setAccountType(request.accountType());
        account.setBalance(request.initialBalance());
        account.setAccountNumber(generateAccountNumber());
        account.setClabe(generateClabe());
        
        Account saved = repository.save(account);
        log.info("Apertura exitosa. ID: {}, Número: {}", saved.getId(), saved.getAccountNumber());
        return saved;
    }

    private String generateClabe() {
        return "012" + (long)(Math.random() * 1000000000000000L);
    }

    public List<Account> findAll() {
        return repository.findAll();
    }

    public Account findById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new BusinessException("Cuenta no encontrada: " + id));
    }

    public List<Account> findByCustomerId(String customerId) {
        return repository.findByCustomer_CustomerId(customerId);
    }

    @Transactional
    public void deposit(Long accountId, BigDecimal amount) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("El monto a depositar debe ser mayor a cero");
        }
        Account account = findById(accountId);
        account.setBalance(account.getBalance().add(amount));
    }

    @Transactional
    public void withdraw(Long accountId, BigDecimal amount) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("El monto a retirar debe ser mayor a cero");
        }
        Account account = findById(accountId);
        if (account.getBalance().compareTo(amount) < 0) {
            throw new BusinessException("Saldo insuficiente");
        }
        account.setBalance(account.getBalance().subtract(amount));
    }

    private String generateAccountNumber() {
        return "AT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }
}
