package com.shl.operations;

import com.shl.operations.security.ReleaseSafety;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class ReleaseSafetyTest {
    private static final String KEY = "a".repeat(64);

    @Test void productionAndProdProfilesMustEnforceMfa() {
        assertThatThrownBy(() -> ReleaseSafety.verify("production","",false,KEY))
            .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> ReleaseSafety.verify("development","prod",false,KEY))
            .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> ReleaseSafety.verify("development","test,production",true,"bad"))
            .isInstanceOf(IllegalStateException.class);
        assertThatCode(() -> ReleaseSafety.verify("prod","",true,KEY))
            .doesNotThrowAnyException();
    }

    @Test void developmentPreservesLocalMfaOnboarding() {
        assertThat(ReleaseSafety.isProduction("development","dev,test")).isFalse();
        assertThat(ReleaseSafety.isProduction("PRODUCTION","")).isTrue();
        assertThatCode(() -> ReleaseSafety.verify("development","test",false,""))
            .doesNotThrowAnyException();
    }
}
