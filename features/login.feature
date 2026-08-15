Feature: User login

  Scenario: Valid credentials show the dashboard
    Given I am on the login page
    When I login with valid credentials
    Then I should see the dashboard

  Scenario: Invalid credentials show an error
    Given I am on the login page
    When I login with invalid credentials
    Then I should see an error message
