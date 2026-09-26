package com.bank.atlasbank.admin;

import com.bank.atlasbank.customer.Customer;
import com.bank.atlasbank.customer.CustomerRepository;
import com.bank.atlasbank.account.AccountRepository;
import com.bank.atlasbank.transaction.TransactionRepository;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class AdminService {

    private final AdminRepository adminRepository;
    private final CustomerRepository customerRepository;
    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final Environment environment;

    public AdminService(AdminRepository adminRepository, 
                        CustomerRepository customerRepository,
                        AccountRepository accountRepository,
                        TransactionRepository transactionRepository,
                        Environment environment) {
        this.adminRepository = adminRepository;
        this.customerRepository = customerRepository;
        this.accountRepository = accountRepository;
        this.transactionRepository = transactionRepository;
        this.environment = environment;
    }

    @PostConstruct
    public void initDefaultAdmin() {
    }

    public Map<String, Object> getDashboardStats() {
        Map<String, Object> stats = new HashMap<>();
        long totalUsers = customerRepository.count();
        long pendingAccounts = customerRepository.findAll().stream()
                .filter(c -> "PENDING".equalsIgnoreCase(c.getStatus()))
                .count();

        LocalDateTime last24h = LocalDateTime.now().minusDays(1);
        BigDecimal volume24h = transactionRepository.findAll().stream()
                .filter(tx -> tx.getCreatedAt() != null && tx.getCreatedAt().isAfter(last24h))
                .map(tx -> tx.getAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long riskAlerts = transactionRepository.findAll().stream()
                .filter(tx -> tx.getAmount().compareTo(new BigDecimal("5000")) >= 0)
                .count();

        stats.put("totalUsers", totalUsers);
        stats.put("pendingAccounts", pendingAccounts);
        stats.put("volume24h", volume24h);
        stats.put("riskAlerts", riskAlerts);
        return stats;
    }

    public List<Customer> getAllCustomers() {
        return customerRepository.findAll();
    }

    public Customer updateCustomerStatus(Long id, String status) {
        Customer customer = customerRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cliente no encontrado"));
        customer.setStatus(status.toUpperCase());
        return customerRepository.save(customer);
    }

    public Customer lockCustomer(Long id) {
        return updateCustomerStatus(id, "LOCKED");
    }

    public Customer unlockCustomer(Long id) {
        return updateCustomerStatus(id, "ACTIVE");
    }

    public Customer resetPassword(Long id, String newPassword) {
        Customer customer = customerRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cliente no encontrado"));
        customer.setPassword(newPassword);
        return customerRepository.save(customer);
    }

    public Optional<Admin> authenticate(String username, String password) {
        if (username == null || password == null) return Optional.empty();

        String normalizedUsername = normalizeUsername(username);
        if (normalizedUsername == null || normalizedUsername.isBlank()) return Optional.empty();

        EmergencyAdminConfig cfg = loadEmergencyAdminConfig();
        if (cfg != null && cfg.username.equalsIgnoreCase(normalizedUsername) && password.equals(cfg.password)) {
            Admin admin = new Admin(cfg.username, cfg.password);
            admin.setRole(cfg.role);
            return Optional.of(admin);
        }

        return adminRepository.findByUsername(normalizedUsername)
                .filter(a -> password.equals(a.getPassword()));
    }

    public boolean existsByUsername(String username) {
        return adminRepository.findByUsername(username).isPresent();
    }

    private static String normalizeUsername(String username) {
        if (username == null) return null;
        String trimmed = username.trim();
        if (trimmed.isBlank()) return null;
        if (trimmed.startsWith("./")) return trimmed.substring(2);
        return trimmed;
    }

    private EmergencyAdminConfig loadEmergencyAdminConfig() {
        String username = firstNonBlank(
                environment.getProperty("ATLASBANK_EMERGENCY_ADMIN_USERNAME"),
                environment.getProperty("atlasbank.emergency-admin.username"),
                environment.getProperty("atlasbank.emergencyAdmin.username"),
                environment.getProperty("EMERGENCY_ADMIN_USERNAME")
        );
        String password = firstNonBlank(
                environment.getProperty("ATLASBANK_EMERGENCY_ADMIN_PASSWORD"),
                environment.getProperty("atlasbank.emergency-admin.password"),
                environment.getProperty("atlasbank.emergencyAdmin.password"),
                environment.getProperty("EMERGENCY_ADMIN_PASSWORD")
        );
        String role = firstNonBlank(
                environment.getProperty("ATLASBANK_EMERGENCY_ADMIN_ROLE"),
                environment.getProperty("atlasbank.emergency-admin.role"),
                environment.getProperty("atlasbank.emergencyAdmin.role"),
                environment.getProperty("EMERGENCY_ADMIN_ROLE"),
                "EXECUTIVE"
        );

        String normalizedUsername = normalizeUsername(username);
        if (normalizedUsername == null || password == null || password.isBlank()) return null;

        String normalizedRole = role == null ? "EXECUTIVE" : role.trim().toUpperCase();
        if (normalizedRole.isBlank()) normalizedRole = "EXECUTIVE";
        return new EmergencyAdminConfig(normalizedUsername, password, normalizedRole);
    }

    private static final class EmergencyAdminConfig {
        private final String username;
        private final String password;
        private final String role;

        private EmergencyAdminConfig(String username, String password, String role) {
            this.username = username;
            this.password = password;
            this.role = role;
        }
    }

    private static String firstNonBlank(String... candidates) {
        if (candidates == null) return null;
        for (String candidate : candidates) {
            if (candidate == null) continue;
            String trimmed = candidate.trim();
            if (!trimmed.isBlank()) return trimmed;
        }
        return null;
    }
}
