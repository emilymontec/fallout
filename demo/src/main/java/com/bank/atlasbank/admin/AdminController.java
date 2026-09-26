package com.bank.atlasbank.admin;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    @Autowired
    private AdminService adminService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String username = credentials.get("username");
        String password = credentials.get("password");

        Optional<Admin> admin = adminService.authenticate(username, password);
        if (admin.isPresent()) {
            String role = admin.get().getRole() == null ? "" : admin.get().getRole().trim().toUpperCase();
            return ResponseEntity.ok(Map.of(
                "success", true,
                "role", role
            ));
        }
        return ResponseEntity.status(401).body(Map.of(
            "success", false,
            "message", "Credenciales inválidas"
        ));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        return ResponseEntity.ok(adminService.getDashboardStats());
    }

    @GetMapping("/customers")
    public ResponseEntity<?> getCustomers() {
        return ResponseEntity.ok(adminService.getAllCustomers());
    }

    @PutMapping("/customers/{id}/status")
    public ResponseEntity<?> updateCustomerStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String status = body.get("status");
        if (status == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(adminService.updateCustomerStatus(id, status));
    }

    @PostMapping("/customers/{id}/lock")
    public ResponseEntity<?> lockCustomer(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.lockCustomer(id));
    }

    @PostMapping("/customers/{id}/unlock")
    public ResponseEntity<?> unlockCustomer(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.unlockCustomer(id));
    }

    @PostMapping("/customers/{id}/reset-password")
    public ResponseEntity<?> resetPassword(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String newPassword = body.get("password");
        String adminRole = body.get("adminRole"); // Simulated role check for simplicity in this demo

        if (!"ADMIN".equalsIgnoreCase(adminRole)) {
            return ResponseEntity.status(403).body(Map.of("message", "Permisos insuficientes para recuperación de cuenta. Se requiere rol ADMIN."));
        }

        if (newPassword == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(adminService.resetPassword(id, newPassword));
    }
}
