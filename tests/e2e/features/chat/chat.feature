@ui
Feature: Chat System
  As a user
  I want to chat with the AI
  So that I can have conversations

  Background:
    Given I am on the chat page

  @smoke
  Scenario: Chat page loads
    Then I should see the chat interface
    And I should see the chat sidebar

  @requires-lmstudio @smoke
  Scenario: Create new chat
    Given at least one AI provider is enabled
    When I click the "New Chat" button
    Then a new chat should be created

  @requires-lmstudio
  Scenario: Send message and receive response
    Given I have an active chat
    When I type "Hello, how are you?" in the message input
    And I send the message
    Then my message should appear in the chat
    And I should receive an AI response

  @api @smoke
  Scenario: API - List chats
    When I GET "/api/chat"
    Then the response should be successful

  @api
  Scenario: API - Create chat session
    When I POST to "/api/chat" with a template
    Then the response should contain a chat id
