package com.bank.atlasbank;

import com.bank.atlasbank.admin.Admin;
import com.bank.atlasbank.admin.AdminRepository;
import com.bank.atlasbank.customer.Customer;
import com.bank.atlasbank.customer.CustomerRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Siembra datos iniciales en la BD si no existen.
 * Garantiza que siempre haya al menos un admin y un cliente funcionales.
 */
@Component
public class DataInitializer {

    private final AdminRepository adminRepository;
    private final CustomerRepository customerRepository;
    private final com.bank.atlasbank.account.AccountRepository accountRepository;
    private final Environment environment;

    public DataInitializer(AdminRepository adminRepository,
                           CustomerRepository customerRepository,
                           com.bank.atlasbank.account.AccountRepository accountRepository,
                           Environment environment) {
        this.adminRepository = adminRepository;
        this.customerRepository = customerRepository;
        this.accountRepository = accountRepository;
        this.environment = environment;
    }

    @PostConstruct
    public void init() {
        seedAdmin();
        seedCustomer();
        printStatus();
    }

    private void seedAdmin() {
        String adminUsername = firstNonBlank(environment.getProperty("ATLASBANK_SEED_ADMIN_USERNAME"));
        String adminPassword = firstNonBlank(environment.getProperty("ATLASBANK_SEED_ADMIN_PASSWORD"));
        String adminRole = firstNonBlank(environment.getProperty("ATLASBANK_SEED_ADMIN_ROLE"), "ADMIN");

        if (adminUsername == null || adminPassword == null) {
            return;
        }

        if (adminRepository.count() == 0) {
            Admin admin = new Admin(adminUsername, adminPassword);
            admin.setRole(adminRole);
            adminRepository.save(admin);
            System.out.println("[AtlasBank] Admin sembrado desde entorno.");
        }
    }

    private void seedCustomer() {
        String seedCustomerId = firstNonBlank(environment.getProperty("ATLASBANK_SEED_CUSTOMER_ID"));
        String seedCustomerPassword = firstNonBlank(environment.getProperty("ATLASBANK_SEED_CUSTOMER_PASSWORD"));
        String seedCustomerEmail = firstNonBlank(environment.getProperty("ATLASBANK_SEED_CUSTOMER_EMAIL"));
        String seedCustomerName = firstNonBlank(environment.getProperty("ATLASBANK_SEED_CUSTOMER_NAME"), "Cliente Demo AtlasBank");
        String seedCustomerPhone = firstNonBlank(environment.getProperty("ATLASBANK_SEED_CUSTOMER_PHONE"), "+52 000 000 0000");
        String seedInitialBalance = firstNonBlank(environment.getProperty("ATLASBANK_SEED_INITIAL_BALANCE"), "1500.00");

        if (seedCustomerId == null || seedCustomerPassword == null || seedCustomerEmail == null) {
            return;
        }

        // Un cliente es "funcional" solo si tiene AMBOS: customerId y password
        boolean hayClienteFuncional = customerRepository.findAll().stream()
                .anyMatch(c -> c.getCustomerId() != null && !c.getCustomerId().isBlank()
                            && c.getPassword() != null && !c.getPassword().isBlank());

        if (!hayClienteFuncional) {
            // Verificar que el email demo no exista ya
            if (customerRepository.findByEmail(seedCustomerEmail).isEmpty()) {
                Customer cliente = new Customer();
                cliente.setCustomerId(seedCustomerId);
                cliente.setFullName(seedCustomerName);
                cliente.setEmail(seedCustomerEmail);
                cliente.setPhone(seedCustomerPhone);
                cliente.setPassword(seedCustomerPassword);
                cliente.setStatus("ACTIVE");
                customerRepository.save(cliente);

                com.bank.atlasbank.account.Account acc = new com.bank.atlasbank.account.Account();
                acc.setCustomer(cliente);
                acc.setAccountType(com.bank.atlasbank.account.AccountType.SAVINGS);
                acc.setBalance(new java.math.BigDecimal(seedInitialBalance));
                acc.setAccountNumber("AT-DEMO-" + java.util.UUID.randomUUID().toString().substring(0, 4).toUpperCase());
                accountRepository.save(acc);

                System.out.println("[AtlasBank] Cliente demo sembrado desde entorno.");
            }
        }
    }

    /** Muestra en consola las credenciales disponibles para acceder */
    private void printStatus() {
        System.out.println("\n=== AtlasBank - Credenciales disponibles ===");
        System.out.println("[ADMIN] Emergency → configurado por variables de entorno.");
        adminRepository.findAll().forEach(a ->
            System.out.println("[ADMIN] BD → usuario: " + a.getUsername() + " | rol: " + a.getRole())
        );
        customerRepository.findAll().stream()
            .filter(c -> c.getCustomerId() != null && c.getPassword() != null)
            .forEach(c ->
                System.out.println("[CLIENTE] customerId: " + c.getCustomerId() + " | nombre: " + c.getFullName())
            );
        System.out.println("============================================\n");
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
