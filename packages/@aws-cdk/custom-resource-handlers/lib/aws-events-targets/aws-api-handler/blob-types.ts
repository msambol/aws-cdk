export interface BlobTypeMapping {
  [service: string]: {
    [action: string]: string[]
  }
};

export const blobTypes: BlobTypeMapping = {
  kinesisanalytics: {
    createapplication: ['ApplicationConfiguration.ApplicationCodeConfiguration.CodeContent.ZipFileContent'],
    updateapplication: ['ApplicationConfigurationUpdate.ApplicationCodeConfigurationUpdate.CodeContentUpdate.ZipFileContentUpdate'],
  },
  kinesis: {
    putrecord: ['Data'],
    putrecords: ['Records.*.Data'],
  },
  kms: {
    decrypt: ['CiphertextBlob', 'Recipient.AttestationDocument'],
    encrypt: ['Plaintext'],
    generatedatakey: ['Recipient.AttestationDocument'],
    generatedatakeypair: ['Recipient.AttestationDocument'],
    generatemac: ['Message'],
    generaterandom: ['Recipient.AttestationDocument'],
    importkeymaterial: ['ImportToken', 'EncryptedKeyMaterial'],
    reencrypt: ['CiphertextBlob'],
    sign: ['Message'],
    verify: ['Message', 'Signature'],
    verifymac: ['Message', 'Mac'],
  },
};