package com.bank.atlasbank.savings;

import com.bank.atlasbank.customer.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SavingsGoalRepository extends JpaRepository<SavingsGoal, Long> {
    List<SavingsGoal> findByCustomer(Customer customer);
    List<SavingsGoal> findByCustomerAndCompleted(Customer customer, boolean completed);
}
