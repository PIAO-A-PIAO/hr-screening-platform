import { AttemptsController } from './attempts.controller';
import { AttemptsService } from './attempts.service';
import { TestsService } from '../tests/tests.service';
import { QuestionsService } from '../questions/questions.service';

describe('Candidate test response', () => {
  it('removes correct answer flags and answer hints', async () => {
    const attempts = { resolveInviteToken: jest.fn().mockResolvedValue({ testId: 't1' }) };
    const tests = { getTest: jest.fn().mockResolvedValue({ id: 't1', questions: [
      { id: 'q1', type: 'MULTIPLE_CHOICE', item: { options: [{ id: 'a', isCorrect: true }, { id: 'b', isCorrect: false }] } },
      { id: 'q2', type: 'SHORT_ANSWER', item: { answerHint: 'secret', maxLength: 100 } },
    ] }) };
    const controller = new AttemptsController(attempts as unknown as AttemptsService, tests as unknown as TestsService, {} as QuestionsService);
    const result = await controller.candidateTest('token');
    expect(JSON.stringify(result)).not.toContain('isCorrect');
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(tests.getTest).toHaveBeenCalledWith('t1');
  });
});

describe('Candidate attempt detail', () => {
  it('does not expose reviewer feedback or answer keys', async () => {
    const service = new AttemptsService({} as never, {} as never, {} as never);
    jest.spyOn(service as never, 'readAttemptDetail').mockResolvedValue({
      id: 'a1', scoreSum: 8, scoreState: 'FINAL', responses: [{ type: 'MULTIPLE_CHOICE', score: 8, evaluatorComment: 'private', item: { options: [{ id: 'o1', isCorrect: true }] } }],
    } as never);
    const result = await service.getAttempt('a1', 'token');
    const json = JSON.stringify(result);
    expect(json).not.toContain('isCorrect');
    expect(json).not.toContain('private');
    expect(json).not.toContain('scoreSum');
  });
});
