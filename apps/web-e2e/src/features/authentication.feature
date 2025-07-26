Feature: User Authentication
  As a user
  I want to authenticate with the application
  So that I can access protected features

  Background:
    Given the user is on the home page

  Scenario: User can access login form
    When the user clicks on "Sign In"
    Then the user sees the login form
    And the user sees "Welcome Back" heading
    And the user sees email input field
    And the user sees password input field
    And the user sees "Remember me" checkbox
    And the user sees "Sign In" button

  Scenario: User can access registration form
    When the user clicks on "Sign Up"
    Then the user sees the registration form
    And the user sees "Create Account" heading
    And the user sees first name input field
    And the user sees last name input field
    And the user sees email input field
    And the user sees password input field
    And the user sees confirm password input field
    And the user sees "Create Account" button

  Scenario: User can toggle between login and registration
    When the user clicks on "Sign In"
    Then the user sees the login form
    When the user clicks on "Sign up here"
    Then the user sees the registration form
    When the user clicks on "Sign in here"
    Then the user sees the login form

  Scenario: User sees validation errors on empty login
    When the user clicks on "Sign In"
    And the user clicks on "Sign In" button
    Then the user sees "Email is required" error
    And the user sees "Password is required" error

  Scenario: User sees validation errors on empty registration
    When the user clicks on "Sign Up"
    And the user clicks on "Create Account" button
    Then the user sees "First name is required" error
    And the user sees "Last name is required" error
    And the user sees "Email is required" error
    And the user sees "Password is required" error
    And the user sees "Please confirm your password" error

  Scenario: User sees email validation error
    When the user clicks on "Sign In"
    And the user enters "invalid-email" in email field
    And the user clicks on "Sign In" button
    Then the user sees "Please enter a valid email address" error

  Scenario: User sees password strength validation
    When the user clicks on "Sign Up"
    And the user enters "weak" in password field
    And the user clicks on "Create Account" button
    Then the user sees "Password must be at least 8 characters long" error

  Scenario: User sees password mismatch error
    When the user clicks on "Sign Up"
    And the user enters "StrongPass123" in password field
    And the user enters "DifferentPass123" in confirm password field
    And the user clicks on "Create Account" button
    Then the user sees "Passwords do not match" error

  Scenario: User can close authentication modal
    When the user clicks on "Sign In"
    Then the user sees the login form
    When the user clicks on close button
    Then the user does not see the authentication modal

  Scenario: User successfully registers new account
    When the user clicks on "Sign Up"
    And the user enters "John" in first name field
    And the user enters "Doe" in last name field
    And the user enters "john.doe@example.com" in email field
    And the user enters "SecurePass123" in password field
    And the user enters "SecurePass123" in confirm password field
    And the user clicks on "Create Account" button
    Then the user sees "Welcome back, John!" message
    And the user sees the user menu with "John Doe"
    And the user does not see the authentication modal

  Scenario: User successfully logs in
    Given "John Doe" has an account
    When the user clicks on "Sign In"
    And the user enters "john.doe@example.com" in email field
    And the user enters "SecurePass123" in password field
    And the user clicks on "Sign In" button
    Then the user sees "Welcome back, John!" message
    And the user sees the user menu with "John Doe"
    And the user does not see the authentication modal

  Scenario: User sees error for invalid credentials
    When the user clicks on "Sign In"
    And the user enters "wrong@example.com" in email field
    And the user enters "WrongPass123" in password field
    And the user clicks on "Sign In" button
    Then the user sees "Invalid email or password" error

  Scenario: User can logout
    Given "John Doe" is logged in
    When the user clicks on the user menu
    And the user clicks on "Sign Out"
    Then the user sees "Sign In" button
    And the user sees "Sign Up" button
    And the user does not see the user menu

  Scenario: Authenticated user sees protected content
    Given "John Doe" is logged in
    Then the user sees "You are successfully authenticated" message
    And the user sees protected HelloWorld component

  Scenario: Unauthenticated user sees public content
    Then the user sees "Authentication Demo" message
    And the user sees "Sign in or create an account to access protected features" message
    And the user sees HelloWorld component