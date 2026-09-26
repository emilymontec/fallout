package com.bank.atlasbank.customer;

import com.bank.atlasbank.common.exception.BusinessException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class CustomerService {

    private final CustomerRepository repository;

    public CustomerService(CustomerRepository repository) {
        this.repository = repository;
    }

    public Customer create(CreateCustomerRequest request) {
        String customerId = normalize(request.customerId());
        String email = normalize(request.email());
        String phone = normalizeOrEmpty(request.phone());
        String password = request.password();

        if (customerId == null) {
            throw new BusinessException("customerId es obligatorio");
        }
        if (email == null) {
            throw new BusinessException("Email es obligatorio");
        }
        if (password == null || password.isBlank()) {
            throw new BusinessException("password es obligatorio");
        }

        repository.findByCustomerId(customerId).ifPresent(existing -> {
            throw new BusinessException("Ya existe un cliente con ese customerId");
        });

        repository.findByEmail(email).ifPresent(existing -> {
            throw new BusinessException("Ya existe un cliente con ese email");
        });

        String fullName = resolveFullName(request);
        if (fullName == null) {
            throw new BusinessException("fullName es obligatorio");
        }

        Customer customer = new Customer();
        customer.setCustomerId(customerId);
        customer.setFullName(fullName);
        customer.setEmail(email);
        customer.setPhone(phone);
        customer.setPassword(password);
        return repository.save(customer);
    }

    public Optional<Customer> authenticate(String customerId, String password) {
        if (customerId == null || password == null)
            return Optional.empty();
        String normalizedCustomerId = normalize(customerId);
        if (normalizedCustomerId == null)
            return Optional.empty();

        return repository.findByCustomerId(normalizedCustomerId)
                .filter(customer -> password.equals(customer.getPassword()));
    }

    public List<Customer> findAll() {
        return repository.findAll();
    }

    public Customer findById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new BusinessException("Cliente no encontrado: " + id));
    }

    public Customer findByCustomerId(String customerId) {
        return repository.findByCustomerId(customerId)
                .orElseThrow(() -> new BusinessException("Identificador de cliente no válido: " + customerId));
    }

    public Customer updateProfile(String customerId, UpdateCustomerProfileRequest request) {
        Customer customer = findByCustomerId(customerId);

        String fullName = normalize(request.fullName());
        String email = normalize(request.email());
        String phone = normalize(request.phone());

        if (fullName == null) {
            throw new BusinessException("fullName es obligatorio");
        }
        if (email == null) {
            throw new BusinessException("email es obligatorio");
        }
        if (phone == null) {
            throw new BusinessException("phone es obligatorio");
        }

        repository.findByEmail(email)
                .filter(existing -> !existing.getId().equals(customer.getId()))
                .ifPresent(existing -> {
                    throw new BusinessException("Ya existe un cliente con ese email");
                });

        customer.setFullName(fullName);
        customer.setEmail(email);
        customer.setPhone(phone);
        return repository.save(customer);
    }

    private static String resolveFullName(CreateCustomerRequest request) {
        String fullName = normalizeOrNull(request.fullName());
        if (fullName != null)
            return fullName;

        String firstName = normalizeOrNull(request.firstName());
        String lastName = normalizeOrNull(request.lastName());

        if (firstName == null && lastName == null)
            return null;
        if (firstName == null)
            return lastName;
        if (lastName == null)
            return firstName;
        return firstName + " " + lastName;
    }

    private static String normalize(String value) {
        if (value == null)
            return null;
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private static String normalizeOrNull(String value) {
        return normalize(value);
    }

    private static String normalizeOrEmpty(String value) {
        String normalized = normalize(value);
        return normalized == null ? "" : normalized;
    }
}
