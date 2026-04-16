import {Composition} from 'remotion';
import {IdeaFoodPromo} from './IdeaFoodPromo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="IdeaFoodPromo"
        component={IdeaFoodPromo}
        durationInFrames={450}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
