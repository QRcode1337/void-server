@ui
Feature: Prompt Variables
  As a user
  I want to manage prompt variables
  So that I can reuse values across templates

  Background:
    Given I am on the variables page

  @smoke
  Scenario: Variables page loads
    Then I should see the "Variables" heading
    And I should see variables grouped by category

  Scenario: Create new variable
    When I click the "New Variable" button
    And I fill in the variable form
    And I save the variable
    Then I should see the new variable in the list

  @api @smoke
  Scenario: API - List variables
    When I GET "/api/prompts/variables"
    Then the response should contain variables
