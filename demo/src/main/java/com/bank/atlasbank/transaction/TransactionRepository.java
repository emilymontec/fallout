package com.bank.atlasbank.transaction;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TransactionRepository extends JpaRepository<BankTransaction, Long> {
}
