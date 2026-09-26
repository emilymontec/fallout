package com.bank.atlasbank.security;

import com.bank.atlasbank.customer.Customer;
import com.bank.atlasbank.customer.CustomerRepository;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;

@Service
public class AntiFraudService {

    private final CustomerRepository customerRepository;
    private static final BigDecimal MAX_SAFE_AMOUNT = new BigDecimal("10000");

    public AntiFraudService(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    /**
     * Analyzes a transaction for suspicious patterns.
     * @return true if fraud is detected, false otherwise.
     */
    public boolean analyzeTransaction(Customer customer, BigDecimal amount, String location) {
        boolean suspicious = false;
        String reason = "";

        // Pattern 1: High Amount
        if (amount.compareTo(MAX_SAFE_AMOUNT) > 0) {
            suspicious = true;
            reason = "Monto inusual detectado: $" + amount;
        }

        // Pattern 2: Foreign Location (Simulated)
        if (location != null && !location.equalsIgnoreCase("Colombia") && !location.equalsIgnoreCase("Local")) {
            suspicious = true;
            reason = "Acceso o compra desde país no habitual: " + location;
        }

        if (suspicious) {
            blockAccount(customer, reason);
            return true;
        }

        return false;
    }

    private void blockAccount(Customer customer, String reason) {
        customer.setStatus("BLOCKED");
        // In a real app we'd save the reason in an audit log
        customerRepository.save(customer);
        System.out.println("ALERT: Account " + customer.getCustomerId() + " blocked due to: " + reason);
    }
}
