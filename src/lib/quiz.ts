
export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

export const quizQuestions: QuizQuestion[] = [
  {
    question: "What is the primary role of a listener on MindToCare?",
    options: [
      "To give the user good advice on what to do.",
      "To provide a non-judgmental space for the user to express themselves.",
      "To become friends with the user.",
      "To solve the user's problems for them.",
    ],
    correctAnswer: "To provide a non-judgmental space for the user to express themselves.",
  },
  {
    question: "A user tells you they are feeling hopeless. Which response is an example of 'reflecting feelings'?",
    options: [
      "\"You should try to think more positively.\"",
      "\"I felt that way once, and I got over it.\"",
      "\"It sounds like you're feeling really hopeless right now.\"",
      "\"What can you do to stop feeling that way?\"",
    ],
    correctAnswer: "\"It sounds like you're feeling really hopeless right now.\"",
  },
  {
    question: "If a user shares that they are planning to harm themselves, what is your most important responsibility?",
    options: [
      "Try to talk them out of it yourself.",
      "Tell them you're not qualified to help and end the chat.",
      "Immediately guide them to professional crisis resources and use the report feature.",
      "Change the subject to something more positive.",
    ],
    correctAnswer: "Immediately guide them to professional crisis resources and use the report feature.",
  },
  {
    question: "Which of the following is an 'open-ended' question?",
    options: [
      "\"Are you feeling sad?\"",
      "\"Did that make you angry?\"",
      "\"How did that situation make you feel?\"",
      "\"Do you want to talk about it?\"",
    ],
    correctAnswer: "\"How did that situation make you feel?\"",
  },
  {
    question: "A user is expressing a belief you strongly disagree with. What should you do?",
    options: [
      "Politely explain why their belief is wrong.",
      "Respect their perspective and continue to listen without judgment.",
      "End the conversation because you can't help them.",
      "Pretend to agree with them to avoid conflict.",
    ],
    correctAnswer: "Respect their perspective and continue to listen without judgment.",
  },
  {
    question: "Why is it important to avoid giving advice?",
    options: [
      "Because your advice might be bad.",
      "It empowers the user to find their own solutions and builds their confidence.",
      "It's against the law.",
      "It's quicker to just listen.",
    ],
    correctAnswer: "It empowers the user to find their own solutions and builds their confidence.",
  },
  {
    question: "What does it mean to maintain confidentiality?",
    options: [
      "You can only tell your close friends about the conversation.",
      "You do not share any part of the conversation or user's identity with anyone, ever.",
      "You can share the story but change the names.",
      "Confidentiality is not important for listeners.",
    ],
    correctAnswer: "You do not share any part of the conversation or user's identity with anyone, ever.",
  },
  {
    question: "A user asks for your social media handle. What is the correct response?",
    options: [
      "Give it to them if you feel comfortable.",
      "Create a separate account just for listening.",
      "Politely decline and explain that all communication must stay on the MindToCare platform for safety and privacy.",
      "Ignore the question and move on.",
    ],
    correctAnswer: "Politely decline and explain that all communication must stay on the MindToCare platform for safety and privacy.",
  },
  {
    question: "What is the purpose of summarizing during a conversation?",
    options: [
      "To show the user you were paying attention and to ensure you understand them correctly.",
      "To make the conversation longer.",
      "To interrupt the user when they are talking too much.",
      "To prove your point.",
    ],
    correctAnswer: "To show the user you were paying attention and to ensure you understand them correctly.",
  },
  {
    question: "A user is silent for a long time. What should you do?",
    options: [
      "End the chat because they are not talking.",
      "Keep sending messages until they respond.",
      "Give them space, and after a moment, gently say something like 'It's okay to take your time' or 'I'm still here with you'.",
      "Assume the connection was lost.",
    ],
    correctAnswer: "Give them space, and after a moment, gently say something like 'It's okay to take your time' or 'I'm still here with you'.",
  },
];
