package com.shl.operations;

import java.util.Map;
import org.springframework.dao.*;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.ErrorResponse;
import org.slf4j.LoggerFactory;

@RestControllerAdvice
public class ApiErrors {
    private ResponseEntity<Map<String,String>> error(HttpStatusCode status,String message,String code) {
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(Map.of("error",message,"code",code));
    }
    @ExceptionHandler(ResponseStatusException.class) ResponseEntity<?> status(ResponseStatusException e) {
        return error(e.getStatusCode(),e.getStatusCode().is4xxClientError()&&e.getReason()!=null?e.getReason():"The service could not complete this request.","REQUEST_REJECTED");
    }
    @ExceptionHandler({MethodArgumentNotValidException.class,HttpMessageNotReadableException.class,IllegalArgumentException.class,MethodArgumentTypeMismatchException.class})
    ResponseEntity<?> invalid(Exception e) { return error(HttpStatus.BAD_REQUEST,"Check the required fields and input format.","INVALID_INPUT"); }
    @ExceptionHandler(DataIntegrityViolationException.class) ResponseEntity<?> conflict(Exception e) {
        return error(HttpStatus.CONFLICT,"This record conflicts with an existing record or business constraint.","DATA_CONFLICT");
    }
    @ExceptionHandler(DataAccessException.class) ResponseEntity<?> unavailable(Exception e) {
        return error(HttpStatus.SERVICE_UNAVAILABLE,"The data service is temporarily unavailable.","DATA_UNAVAILABLE");
    }
    @ExceptionHandler(AccessDeniedException.class) ResponseEntity<?> forbidden(Exception e) {
        return error(HttpStatus.FORBIDDEN,"Your staff role does not permit this action.","ACCESS_DENIED");
    }
    @ExceptionHandler(NoResourceFoundException.class) ResponseEntity<?> missing(Exception e) {
        return error(HttpStatus.NOT_FOUND,"This endpoint is not available.","NOT_FOUND");
    }
    @ExceptionHandler(Exception.class) ResponseEntity<?> unexpected(Exception e) {
        if(e instanceof ErrorResponse protocolError)
            return error(protocolError.getStatusCode(),"The request could not be completed. Check the method and input format.","INVALID_REQUEST");
        LoggerFactory.getLogger(ApiErrors.class).error("Unhandled business request failure: {}",e.getClass().getName());
        return error(HttpStatus.INTERNAL_SERVER_ERROR,"The service could not complete this request. Please retry later.","INTERNAL_ERROR");
    }
}
