import { getFirestore } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

const db = getFirestore();

const getBmadAuthDetails = async () => {
  const { estabelecimentoIdPrincipal } = useAuth();
  const docRef = db.collection('estabelecimentos').doc(estabelecimentoIdPrincipal).collection('integrations').doc('bmad');
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new Error('BMAD Integration details not found.');
  }

  return doc.data();
};

const isBmadActive = async () => {
  try {
    const authDetails = await getBmadAuthDetails();
    return !!authDetails;
  } catch (error) {
    console.error('Error checking BMAD integration status:', error);
    return false;
  }
};

const processBmadPayment = async (amount, paymentMethod) => {
  const authDetails = await getBmadAuthDetails();

  if (!authDetails || !paymentMethod || !amount) {
    throw new Error('Invalid payment processing request.');
  }

  try {
    console.log(`Processing BMAD payment of ${amount} using method ${paymentMethod}`);
    // Simulate network call to BMAD payment endpoint
    await new Promise((resolve) => setTimeout(resolve, 1000)); // mock delay
    console.log('Payment processed successfully!');
  } catch (error) {
    console.error('Error processing BMAD payment:', error);
    throw new Error('Failed to process payment. Please try again.');
  }
};

export { getBmadAuthDetails, isBmadActive, processBmadPayment };