package com.bank.atlasbank.savings;

import com.bank.atlasbank.customer.Customer;
import com.bank.atlasbank.customer.CustomerRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Service
public class SavingsGoalService {

    private final SavingsGoalRepository savingsGoalRepository;
    private final CustomerRepository customerRepository;

    public SavingsGoalService(SavingsGoalRepository savingsGoalRepository, CustomerRepository customerRepository) {
        this.savingsGoalRepository = savingsGoalRepository;
        this.customerRepository = customerRepository;
    }

    public SavingsGoal createGoal(String customerId, SavingsGoal goal) {
        Customer customer = customerRepository.findByCustomerId(customerId)
                .orElseThrow(() -> new RuntimeException("Cliente no encontrado"));
        goal.setCustomer(customer);
        return savingsGoalRepository.save(goal);
    }

    public List<SavingsGoal> getGoalsByCustomer(String customerId) {
        Customer customer = customerRepository.findByCustomerId(customerId)
                .orElseThrow(() -> new RuntimeException("Cliente no encontrado"));
        return savingsGoalRepository.findByCustomer(customer);
    }

    public SavingsGoal addFunds(Long goalId, BigDecimal amount) {
        SavingsGoal goal = savingsGoalRepository.findById(goalId)
                .orElseThrow(() -> new RuntimeException("Meta no encontrada"));
        
        goal.setCurrentAmount(goal.getCurrentAmount().add(amount));
        if (goal.getCurrentAmount().compareTo(goal.getTargetAmount()) >= 0) {
            goal.setCompleted(true);
        }
        return savingsGoalRepository.save(goal);
    }

    public Customer toggleRoundup(String customerId, boolean enabled) {
        Customer customer = customerRepository.findByCustomerId(customerId)
                .orElseThrow(() -> new RuntimeException("Cliente no encontrado"));
        customer.setRoundupEnabled(enabled);
        return customerRepository.save(customer);
    }

    public void processRoundup(String customerId, BigDecimal transactionAmount) {
        Customer customer = customerRepository.findByCustomerId(customerId).orElse(null);
        if (customer == null || !customer.isRoundupEnabled()) return;

        // Calculate roundup to next 1000 (standard in COP) or integer if small
        // For this demo, let's roundup to the nearest 1000
        BigDecimal nextThousand = transactionAmount.divide(new BigDecimal("1000"), 0, BigDecimal.ROUND_CEILING).multiply(new BigDecimal("1000"));
        BigDecimal roundupAmount = nextThousand.subtract(transactionAmount);

        if (roundupAmount.compareTo(BigDecimal.ZERO) > 0) {
            // Find an active goal to add funds to
            List<SavingsGoal> activeGoals = savingsGoalRepository.findByCustomerAndCompleted(customer, false);
            if (!activeGoals.isEmpty()) {
                addFunds(activeGoals.get(0).getId(), roundupAmount);
            }
        }
    }
}
