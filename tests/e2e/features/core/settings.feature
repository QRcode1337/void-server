@smoke @ui
Feature: Settings Page
  As a user
  I want to configure application settings
  So that I can customize my experience

  Background:
    Given I am on the settings page

  @smoke
  Scenario: Settings page loads with tabs
    Then I should see the "General" tab
    And I should see the "Providers" tab

  Scenario: Theme selection
    Given I am on the "General" settings tab
    When I select the "Catppuccin Mocha" theme
    Then I should see a success toast

  Scenario: Auto-collapse navigation toggle
    Given I am on the "General" settings tab
    When I toggle the auto-collapse navigation setting
    Then I should see a success toast

  @smoke
  Scenario: View providers list
    When I click on the "Providers" tab
    Then I should see a list of AI providers

  @api @smoke
  Scenario: API - List providers
    When I GET "/api/ai-providers"
    Then the response should contain providers
