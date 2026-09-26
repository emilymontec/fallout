package com.bank.atlasbank.savings;

import com.bank.atlasbank.customer.Customer;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

@Entity
@Table(name = "savings_goals")
public class SavingsGoal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private BigDecimal targetAmount;

    private BigDecimal currentAmount = BigDecimal.ZERO;

    private LocalDate deadline;

    private boolean completed = false;

    @ManyToOne
    @JoinColumn(name = "customer_id")
    private Customer customer;

    public SavingsGoal() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public BigDecimal getTargetAmount() { return targetAmount; }
    public void setTargetAmount(BigDecimal targetAmount) { this.targetAmount = targetAmount; }

    public BigDecimal getCurrentAmount() { return currentAmount; }
    public void setCurrentAmount(BigDecimal currentAmount) { this.currentAmount = currentAmount; }

    public LocalDate getDeadline() { return deadline; }
    public void setDeadline(LocalDate deadline) { this.deadline = deadline; }

    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { this.completed = completed; }

    public Customer getCustomer() { return customer; }
    public void setCustomer(Customer customer) { this.customer = customer; }

    // Logic for suggesting weekly savings
    public BigDecimal getWeeklySuggestion() {
        if (deadline == null || targetAmount == null) return BigDecimal.ZERO;
        long weeks = ChronoUnit.WEEKS.between(LocalDate.now(), deadline);
        if (weeks <= 0) weeks = 1;
        
        BigDecimal remaining = targetAmount.subtract(currentAmount);
        if (remaining.compareTo(BigDecimal.ZERO) <= 0) return BigDecimal.ZERO;
        
        return remaining.divide(new BigDecimal(weeks), 2, BigDecimal.ROUND_HALF_UP);
    }
}
