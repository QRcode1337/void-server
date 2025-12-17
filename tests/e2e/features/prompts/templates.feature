@ui
Feature: Prompt Templates
  As a user
  I want to manage prompt templates
  So that I can customize AI interactions

  Background:
    Given I am on the templates page

  @smoke
  Scenario: Templates page loads
    Then I should see the "Templates" heading
    And I should see a list of templates

  Scenario: View template details
    When I click on a template
    Then I should see the template editor

  Scenario: Create and delete custom template
    When I click the "New Template" button
    And I fill in the template form
    And I save the template
    Then I should see the new template in the list
    # Cleanup
    When I delete the test template
    Then the test template should be removed

  @api @smoke
  Scenario: API - List templates
    When I GET "/api/prompts/templates"
    Then the response should contain templates
