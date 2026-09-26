package com.bank.atlasbank.transaction;

import com.bank.atlasbank.account.Account;
import com.bank.atlasbank.account.AccountService;
import com.bank.atlasbank.common.exception.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class TransactionService {

    private final AccountService accountService;
    private final TransactionRepository transactionRepository;
    private final com.bank.atlasbank.savings.SavingsGoalService savingsGoalService;
    private final com.bank.atlasbank.security.AntiFraudService antiFraudService;

    public TransactionService(AccountService accountService, 
                              TransactionRepository transactionRepository,
                              com.bank.atlasbank.savings.SavingsGoalService savingsGoalService,
                              com.bank.atlasbank.security.AntiFraudService antiFraudService) {
        this.accountService = accountService;
        this.transactionRepository = transactionRepository;
        this.savingsGoalService = savingsGoalService;
        this.antiFraudService = antiFraudService;
    }

    @Transactional
    public BankTransaction deposit(Long accountId, BigDecimal amount) {
        accountService.deposit(accountId, amount);
        Account account = accountService.findById(accountId);

        BankTransaction tx = new BankTransaction();
        tx.setType(TransactionType.DEPOSIT);
        tx.setAmount(amount);
        tx.setSourceAccount(account);
        return transactionRepository.save(tx);
    }

    @Transactional
    public BankTransaction withdraw(Long accountId, BigDecimal amount) {
        accountService.withdraw(accountId, amount);
        Account account = accountService.findById(accountId);

        BankTransaction tx = new BankTransaction();
        tx.setType(TransactionType.WITHDRAW);
        tx.setAmount(amount);
        tx.setSourceAccount(account);
        BankTransaction saved = transactionRepository.save(tx);
        
        // Process roundup
        if (account.getCustomer() != null) {
            savingsGoalService.processRoundup(account.getCustomer().getCustomerId(), amount);
        }
        
        return saved;
    }

    @Transactional
    public BankTransaction transfer(TransferRequest request) {
        Account source = accountService.findById(request.sourceAccountId());
        Account target = accountService.findById(request.targetAccountId());

        // Anti-fraud check
        if (source.getCustomer() != null) {
            if (antiFraudService.analyzeTransaction(source.getCustomer(), request.amount(), request.location())) {
                throw new BusinessException("Transacción bloqueada por el sistema antifraude. Tu cuenta ha sido restringida por seguridad.");
            }
        }

        if (request.sourceAccountId().equals(request.targetAccountId())) {
            throw new BusinessException("No se puede transferir a la misma cuenta");
        }

        accountService.withdraw(request.sourceAccountId(), request.amount());
        accountService.deposit(request.targetAccountId(), request.amount());

        BankTransaction tx = new BankTransaction();
        tx.setType(TransactionType.TRANSFER);
        tx.setAmount(request.amount());
        tx.setSourceAccount(source);
        tx.setTargetAccount(target);
        BankTransaction saved = transactionRepository.save(tx);

        // Process roundup (from source account owner)
        if (source.getCustomer() != null) {
            savingsGoalService.processRoundup(source.getCustomer().getCustomerId(), request.amount());
        }

        return saved;
    }

    public List<BankTransaction> findAll() {
        return transactionRepository.findAll();
    }
}
