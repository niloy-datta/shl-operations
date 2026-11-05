package com.shl.operations.enterprise;

import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/commerce/line-orders/purchase-orders")
@PreAuthorize("hasAnyRole('ADMIN','MANAGEMENT','SOURCING')")
public class PurchaseOrderMatchingController
{
    private final PurchaseOrderMatchingService matching;

    public PurchaseOrderMatchingController(PurchaseOrderMatchingService matching)
    {
        this.matching = matching;
    }

    @GetMapping("/{id}/reconciliation")
    public PurchaseOrderMatchingService.Match check(@PathVariable UUID id)
    {
        return matching.verify(id);
    }
}
