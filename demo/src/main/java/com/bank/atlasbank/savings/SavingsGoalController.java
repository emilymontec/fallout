package com.bank.atlasbank.savings;

import com.bank.atlasbank.customer.Customer;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/savings")
public class SavingsGoalController {

    private final SavingsGoalService savingsGoalService;

    public SavingsGoalController(SavingsGoalService savingsGoalService) {
        this.savingsGoalService = savingsGoalService;
    }

    @PostMapping("/goals/{customerId}")
    public ResponseEntity<SavingsGoal> createGoal(@PathVariable String customerId, @RequestBody SavingsGoal goal) {
        return ResponseEntity.ok(savingsGoalService.createGoal(customerId, goal));
    }

    @GetMapping("/goals/{customerId}")
    public ResponseEntity<List<SavingsGoal>> getGoals(@PathVariable String customerId) {
        return ResponseEntity.ok(savingsGoalService.getGoalsByCustomer(customerId));
    }

    @PostMapping("/goals/{goalId}/add-funds")
    public ResponseEntity<SavingsGoal> addFunds(@PathVariable Long goalId, @RequestBody Map<String, BigDecimal> body) {
        return ResponseEntity.ok(savingsGoalService.addFunds(goalId, body.get("amount")));
    }

    @PutMapping("/roundup/{customerId}")
    public ResponseEntity<Customer> toggleRoundup(@PathVariable String customerId, @RequestBody Map<String, Boolean> body) {
        return ResponseEntity.ok(savingsGoalService.toggleRoundup(customerId, body.get("enabled")));
    }

    @GetMapping("/suggestion/{goalId}")
    public ResponseEntity<Map<String, BigDecimal>> getSuggestion(@PathVariable Long goalId) {
        // This is a simple logic, but could be expanded
        return ResponseEntity.ok(Map.of("weeklySuggestion", BigDecimal.TEN)); // Placeholder if needed or just use logic in entity
    }
}
